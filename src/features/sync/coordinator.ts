"use client"

import { SyncTransportError } from "@/features/sync/transport-error"
import { supportsRemoteItemCommand } from "@/lib/sync/item-command-support"
import { entityIdSchema, userIdSchema } from "@/schemas/primitives"
import {
  remoteChangesPageSchema,
  remotePushResultSchema,
} from "@/schemas/remote-sync"
import type { CalendarItem } from "@/types/calendar-item"
import type { LocalPullCursor, OutboxEntry } from "@/types/local-sync"
import type { RemoteOperationResult } from "@/types/remote-sync"
import type { SyncOperation } from "@/types/sync"

export interface SyncCoordinatorPorts {
  isActive(): Promise<boolean>
  readIdentity(): Promise<string | null>
  pull(cursor: LocalPullCursor): Promise<unknown>
  push(input: {
    expectedUserId: string
    operations: SyncOperation[]
  }): Promise<unknown>
  readCursor(): Promise<LocalPullCursor>
  applyPage(input: unknown): Promise<unknown>
  listEntries(): Promise<OutboxEntry[]>
  readItem(id: string): Promise<CalendarItem | null>
  recoverExpiredSends(): Promise<unknown>
  claim(operationId: string, ownerId: string): Promise<OutboxEntry | null>
  release(operationId: string, ownerId: string): Promise<unknown>
  applyResult(input: {
    operation: SyncOperation
    senderId: string
    result: RemoteOperationResult
  }): Promise<unknown>
}
export interface SyncPassResult {
  status:
    | "settled"
    | "more_work"
    | "unauthorized"
    | "account_changed"
    | "retry_later"
    | "stopped"
    | "update_required"
    | "recovery_required"
  uploaded: number
  downloaded: number
}

export class SyncCoordinator {
  private readonly userId: string
  private readonly senderId: string
  private stopped = false
  private running: Promise<SyncPassResult> | null = null

  constructor(
    userId: string,
    private readonly ports: SyncCoordinatorPorts,
    senderId = crypto.randomUUID()
  ) {
    this.userId = userIdSchema.parse(userId)
    this.senderId = entityIdSchema.parse(senderId)
  }
  stop() {
    this.stopped = true
  }
  run(): Promise<SyncPassResult> {
    if (this.running) return this.running
    const work = this.pass().finally(() => {
      if (this.running === work) this.running = null
    })
    this.running = work
    return work
  }

  private async pass(): Promise<SyncPassResult> {
    let uploaded = 0
    let downloaded = 0
    const finish = (status: SyncPassResult["status"]): SyncPassResult => ({
      status,
      uploaded,
      downloaded,
    })
    const active = async () => {
      if (this.stopped) return false
      const current = await this.ports.isActive()
      return !this.stopped && current
    }
    try {
      if (this.stopped) return finish("stopped")
      if (!(await active()))
        return finish(this.stopped ? "stopped" : "account_changed")
      const identity = await this.ports.readIdentity()
      if (!identity) return finish("unauthorized")
      if (identity !== this.userId) return finish("account_changed")
      if (!(await active()))
        return finish(this.stopped ? "stopped" : "account_changed")
      await this.ports.recoverExpiredSends()

      const download = async (): Promise<boolean> => {
        if (!(await active())) return false
        const cursor = await this.ports.readCursor()
        if (!(await active())) return false
        const page = remoteChangesPageSchema.parse(
          await this.ports.pull(cursor)
        )
        if (!(await active())) return false
        await this.ports.applyPage({ after: cursor.after, page })
        downloaded += page.changes.length
        return !page.hasMore
      }
      let caughtUp = false
      for (let page = 0; page < 4; page++) {
        caughtUp = await download()
        if (!(await active()))
          return finish(this.stopped ? "stopped" : "account_changed")
        if (caughtUp) break
      }
      if (!caughtUp) return finish("more_work")

      const attempted = new Set<string>()
      let reachedOperationLimit = false
      for (let sentCount = 0; sentCount < 5; sentCount++) {
        if (!(await active()))
          return finish(this.stopped ? "stopped" : "account_changed")
        const entries = await this.ports.listEntries()
        let selected: OutboxEntry | null = null
        for (const entry of entries.toSorted(
          (a, b) => a.sequence - b.sequence
        )) {
          if (entry.userId !== this.userId)
            throw new Error("Outbox account does not match the coordinator")
          if (
            entry.state !== "pending" ||
            attempted.has(entry.operation.operationId)
          )
            continue
          const command = entry.operation.command
          if (!("itemId" in command)) continue
          const item = await this.ports.readItem(command.itemId)
          if (item && item.ownerId !== this.userId)
            throw new Error("Local item account does not match the coordinator")
          if (!supportsRemoteItemCommand(command, item)) continue
          attempted.add(entry.operation.operationId)
          if (!(await active()))
            return finish(this.stopped ? "stopped" : "account_changed")
          selected = await this.ports.claim(
            entry.operation.operationId,
            this.senderId
          )
          if (selected) break
        }
        if (!selected) break
        const operation = selected.operation
        try {
          if (!(await active()))
            return finish(this.stopped ? "stopped" : "account_changed")
          const response = remotePushResultSchema.parse(
            await this.ports.push({
              expectedUserId: this.userId,
              operations: [operation],
            })
          )
          if (response.status === "unauthorized") return finish("unauthorized")
          if (response.status === "account_changed")
            return finish("account_changed")
          if (response.status === "invalid_batch") return finish("retry_later")
          const result = response.results[0]
          if (
            !result ||
            response.results.length !== 1 ||
            result.operationId !== operation.operationId
          )
            return finish("retry_later")
          if (!(await active()))
            return finish(this.stopped ? "stopped" : "account_changed")
          await this.ports.applyResult({
            operation,
            senderId: this.senderId,
            result,
          })
          if (result.status === "applied") uploaded++
          if (sentCount === 4) reachedOperationLimit = true
          if (response.status === "retry_later") return finish("retry_later")
        } finally {
          await this.ports.release(operation.operationId, this.senderId)
        }
      }
      if (!(await active()))
        return finish(this.stopped ? "stopped" : "account_changed")
      if (uploaded && !(await download())) return finish("more_work")
      return finish(reachedOperationLimit ? "more_work" : "settled")
    } catch (error) {
      return finish(
        this.stopped
          ? "stopped"
          : error instanceof SyncTransportError
            ? error.reason
            : "retry_later"
      )
    }
  }
}
