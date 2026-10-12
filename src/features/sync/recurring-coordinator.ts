"use client"

import type {
  RemotePullQuery,
  SyncPassResultV2,
} from "@/features/sync/coordinator-v2"
import { SyncTransportError } from "@/features/sync/transport-error"
import {
  validateLocalRecurringChangesPageInput,
  validateLocalSettingsChangesPageInput,
} from "@/lib/sync/local-recurring-pull"
import { diagnosePersonalQueue } from "@/lib/sync/personal-queue-diagnostics"
import { recurringSyncCapabilityPolicy } from "@/lib/sync/recurring-sync-capabilities"
import { validateRemoteRecurringPushResult } from "@/lib/sync/remote-recurring-push"
import { settingsSyncCapabilityPolicy } from "@/lib/sync/settings-sync-capabilities"
import type { SyncCapabilityPolicy } from "@/lib/sync/sync-capabilities"
import { localPullCursorSchema, outboxEntrySchema } from "@/schemas/local-sync"
import { entityIdSchema, userIdSchema } from "@/schemas/primitives"
import { remotePushInputV2Schema } from "@/schemas/remote-push-v2"
import { remotePullQuerySchema } from "@/schemas/remote-sync"
import type { CalendarItem } from "@/types/calendar-item"
import type { LocalPullCursor, OutboxEntry } from "@/types/local-sync"
import type { PersonalQueueDiagnostics } from "@/types/personal-queue-diagnostics"
import type { RemotePushInputV2 } from "@/types/remote-push-v2"
import type {
  RemoteRecurringChangesPage,
  RemoteRecurringOperationResult,
} from "@/types/remote-recurring-sync"
import type { SyncOperation } from "@/types/sync"

export interface RecurringSyncCoordinatorPorts {
  isActive(): Promise<boolean>
  readIdentity(): Promise<string | null>
  readCursor(): Promise<LocalPullCursor>
  recoverExpiredSends(): Promise<unknown>
  readQueueState(): Promise<{ entries: OutboxEntry[]; items: CalendarItem[] }>
  claim(operationId: string, senderId: string): Promise<OutboxEntry | null>
  release(operationId: string, senderId: string): Promise<unknown>
  pull(query: RemotePullQuery): Promise<unknown>
  push(input: RemotePushInputV2): Promise<unknown>
  applyPage(input: {
    query: RemotePullQuery
    page: RemoteRecurringChangesPage
  }): Promise<unknown>
  applyResult(input: {
    operation: SyncOperation
    senderId: string
    result: RemoteRecurringOperationResult
  }): Promise<unknown>
}
class CoordinatorGuardError extends Error {
  constructor(readonly status: "stopped" | "account_changed") {
    super(`Sync coordinator interrupted: ${status}`)
  }
}

// Prepared recurrent boundary stays separate from active DTOs. Bounded passes never assert convergence.
export class RecurringSyncCoordinator {
  private readonly userId: string
  private readonly policy: SyncCapabilityPolicy
  private readonly senderId: string
  private stopped = false
  private running: Promise<SyncPassResultV2> | null = null
  constructor(
    userId: string,
    private readonly ports: RecurringSyncCoordinatorPorts,
    senderId = crypto.randomUUID(),
    private readonly allowSettings = false
  ) {
    this.policy = allowSettings
      ? settingsSyncCapabilityPolicy
      : recurringSyncCapabilityPolicy
    this.userId = userIdSchema.parse(userId)
    this.senderId = entityIdSchema.parse(senderId)
  }
  stop() {
    this.stopped = true
  }
  run(): Promise<SyncPassResultV2> {
    if (this.running) return this.running
    const work = this.pass().finally(() => {
      if (this.running === work) this.running = null
    })
    this.running = work
    return work
  }
  private async pass(): Promise<SyncPassResultV2> {
    let uploaded = 0
    let downloaded = 0
    let pullCount = 0
    let pushCount = 0
    let claimCount = 0
    let diagnostics: PersonalQueueDiagnostics | null = null
    const finish = (status: SyncPassResultV2["status"]): SyncPassResultV2 => ({
      status,
      uploaded,
      downloaded,
      diagnostics,
    })
    const guard = async () => {
      if (this.stopped) {
        diagnostics = null
        throw new CoordinatorGuardError("stopped")
      }
      const active = await this.ports.isActive()
      if (this.stopped || !active) {
        diagnostics = null
        throw new CoordinatorGuardError(
          this.stopped ? "stopped" : "account_changed"
        )
      }
    }
    const readQueue = async () => {
      await guard()
      const snapshot = structuredClone(await this.ports.readQueueState())
      await guard()
      diagnostics = diagnosePersonalQueue(
        { ...snapshot, userId: this.userId },
        this.policy
      )
      return { snapshot, diagnostics }
    }
    const download = async () => {
      while (pullCount < 4) {
        await guard()
        const cursor = localPullCursorSchema.parse(
          await this.ports.readCursor()
        )
        await guard()
        const query = remotePullQuerySchema.parse({
          after: cursor.after,
          through: cursor.through,
          limit: 50,
        })
        pullCount++
        const raw = await this.ports.pull(structuredClone(query))
        await guard()
        const validateReceipt = this.allowSettings
          ? validateLocalSettingsChangesPageInput
          : validateLocalRecurringChangesPageInput
        const receipt = validateReceipt({ query, page: raw }, this.userId)
        await guard()
        await this.ports.applyPage(structuredClone(receipt))
        downloaded += receipt.page.changes.length
        await guard()
        if (!receipt.page.hasMore) return true
      }
      return false
    }
    try {
      await guard()
      const identity = await this.ports.readIdentity()
      await guard()
      if (!identity) return finish("unauthorized")
      if (identity !== this.userId) {
        diagnostics = null
        return finish("account_changed")
      }
      await this.ports.recoverExpiredSends()
      await guard()
      if (!(await download())) return finish("more_work")
      const attempted = new Set<string>()
      while (pushCount < 5 && claimCount < 5) {
        const state = await readQueue()
        const candidates = state.diagnostics.ready.filter(
          (diagnostic) =>
            diagnostic.entry.state === "pending" &&
            !attempted.has(diagnostic.entry.operation.operationId)
        )
        let sent = false
        for (const candidate of candidates) {
          if (claimCount === 5) break
          const requestedId = candidate.entry.operation.operationId
          attempted.add(requestedId)
          await guard()
          try {
            claimCount++
            const rawClaim = await this.ports.claim(requestedId, this.senderId)
            await guard()
            if (rawClaim === null) continue
            const claimed = outboxEntrySchema.parse(rawClaim)
            if (
              claimed.userId !== this.userId ||
              claimed.operation.operationId !== requestedId ||
              claimed.entityKey !== candidate.entry.entityKey ||
              claimed.state !== "sending" ||
              claimed.lease?.ownerId !== this.senderId
            )
              throw new Error(
                "Claimed sync intention does not match its requested lease"
              )
            const current = await readQueue()
            const stored = current.diagnostics.operations.find(
              (diagnostic) =>
                diagnostic.entry.operation.operationId === requestedId
            )
            if (
              stored?.entry.state !== "sending" ||
              stored.entry.lease?.ownerId !== this.senderId ||
              JSON.stringify(stored.entry.operation) !==
                JSON.stringify(claimed.operation)
            )
              throw new Error("Claimed sync intention changed before transport")
            if (
              stored.blockingOperationIds.length ||
              stored.waitingOperationIds.length
            )
              continue
            const command = claimed.operation.command
            const item =
              "itemId" in command
                ? (current.snapshot.items.find(
                    (record) => record.id === command.itemId
                  ) ?? null)
                : null
            if (!this.policy.readCommand(command, item).supported) continue
            const request = remotePushInputV2Schema.parse({
              transportVersion: 2,
              expectedUserId: this.userId,
              operations: [claimed.operation],
            })
            await guard()
            pushCount++
            const raw = await this.ports.push(structuredClone(request))
            await guard()
            const response = validateRemoteRecurringPushResult(
              raw,
              this.userId,
              request
            )
            if (!("results" in response))
              return finish(
                response.status === "invalid_batch"
                  ? "retry_later"
                  : response.status
              )
            if (response.status === "retry_later") return finish("retry_later")
            const result = response.results[0]
            if (result.kind === "preference") {
              const outcome = result.outcome
              const effects =
                outcome.status === "applied"
                  ? outcome.effects.effects
                  : outcome.status === "conflict"
                    ? [outcome.current]
                    : []
              if (
                effects.some(
                  (effect) =>
                    !this.policy.stores.some((store) => store === effect.store)
                )
              )
                throw new Error(
                  "Mixed push result contains an unsupported local store"
                )
            } else if (
              result.kind === "item" &&
              (result.outcome.status === "applied" ||
                result.outcome.status === "conflict")
            ) {
              const record =
                result.outcome.status === "applied"
                  ? result.outcome.item
                  : result.outcome.current
              if (!this.policy.readCommand(command, record).supported)
                throw new Error(
                  "Mixed push result contains unsupported item content"
                )
            }
            await guard()
            await this.ports.applyResult(
              structuredClone({
                operation: claimed.operation,
                senderId: this.senderId,
                result,
              })
            )
            if (result.outcome.status === "applied") uploaded++
            await guard()
            await readQueue()
            sent = true
          } finally {
            // The requested identity is the only lease this pass may release, even for corrupt claims.
            await this.ports.release(requestedId, this.senderId)
            await guard()
          }
          if (sent) break
        }
        if (!sent) break
      }
      await guard()
      if (uploaded && !(await download())) return finish("more_work")
      await readQueue()
      return finish(
        pushCount === 5 || claimCount === 5 ? "more_work" : "settled"
      )
    } catch (error) {
      if (error instanceof CoordinatorGuardError) return finish(error.status)
      try {
        await guard()
      } catch (guardError) {
        if (guardError instanceof CoordinatorGuardError)
          return finish(guardError.status)
      }
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
