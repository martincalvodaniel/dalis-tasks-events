"use client"

import { openLocalDatabase } from "@/lib/local-db/client"
import { resolveLocalItemViewIncident } from "@/lib/local-db/item-view-resolution"
import { readLocalItemViewResolutionSnapshot } from "@/lib/local-db/item-view-resolution-capture"
import { resolveLocalPlacementIncident } from "@/lib/local-db/placement-resolution"
import { readLocalPlacementResolutionSnapshot } from "@/lib/local-db/placement-resolution-capture"
import { resolveLocalPlanCategoryIncident } from "@/lib/local-db/plan-category-resolution"
import { readLocalPlanCategoryResolutionSnapshot } from "@/lib/local-db/plan-category-resolution-capture"
import { resolveLocalPlanOccurrenceIncident } from "@/lib/local-db/plan-occurrence-resolution"
import { applyLocalChangesPage } from "@/lib/local-db/pull-changes"
import { readLocalSyncQueueSummary } from "@/lib/local-db/queue-summary"
import { resolveLocalSettingsIncident } from "@/lib/local-db/settings-resolution"
import {
  readLocalRecurringSyncIncidentOverview,
  readLocalSettingsSyncIncidentOverview,
  readLocalSyncIncidentOverview,
  readLocalSyncIncidents,
} from "@/lib/local-db/sync-incidents"
import { notifyLocalOutboxChange } from "@/lib/local-db/sync-notifications"
import { resolveLocalSyncIncident } from "@/lib/local-db/sync-resolution"
import { resolveLocalTagDeletionIncident } from "@/lib/local-db/tag-delete-resolution"
import { readLocalTagDeletionResolutionSnapshot } from "@/lib/local-db/tag-delete-resolution-capture"
import { resolveLocalTagOrderIncident } from "@/lib/local-db/tag-order-resolution"
import { readLocalTagOrderResolutionSnapshot } from "@/lib/local-db/tag-order-resolution-capture"
import { resolveLocalTagIncident } from "@/lib/local-db/tag-resolution"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { readItemOutcome, readItemShadow } from "@/lib/sync/item-evidence"
import { planRemoteItemProjection } from "@/lib/sync/item-projection"
import { validateLocalRecurringItemResult } from "@/lib/sync/local-recurring-item-result"
import { calendarItemSchema } from "@/schemas/calendar-item"
import {
  localOperationOutcomeSchema,
  localPullCursorSchema,
  localSyncResultInputSchema,
  outboxEntrySchema,
  remoteShadowSchema,
} from "@/schemas/local-sync"
import { userIdSchema } from "@/schemas/primitives"
import type { CalendarItem } from "@/types/calendar-item"
import type { LocalPullCursor, OutboxEntry } from "@/types/local-sync"

export class LocalSyncStore {
  private constructor(
    readonly userId: string,
    private readonly database: IDBDatabase
  ) {}
  static async open(userIdInput: string): Promise<LocalSyncStore> {
    const userId = userIdSchema.parse(userIdInput)
    return new LocalSyncStore(userId, await openLocalDatabase(userId))
  }
  readPullCursor(): Promise<LocalPullCursor> {
    return runLocalTransaction(
      this.database,
      ["syncMetadata"],
      "readonly",
      (context) => {
        const request = context.transaction
          .objectStore("syncMetadata")
          .get("pull-cursor")
        request.onsuccess = () => {
          try {
            context.setResult(
              localPullCursorSchema.parse(
                request.result ?? {
                  key: "pull-cursor",
                  after: 0,
                  through: null,
                }
              )
            )
          } catch (error) {
            context.fail(error)
          }
        }
      }
    )
  }

  applyChangesPage(input: unknown) {
    return applyLocalChangesPage(this.database, this.userId, input)
  }

  readQueueSummary() {
    return readLocalSyncQueueSummary(this.database, this.userId)
  }

  readIncidents() {
    return readLocalSyncIncidents(this.database, this.userId)
  }

  readIncidentOverview() {
    return readLocalSyncIncidentOverview(this.database, this.userId)
  }

  readRecurringIncidentOverview() {
    return readLocalRecurringSyncIncidentOverview(this.database, this.userId)
  }

  readSettingsIncidentOverview() {
    return readLocalSettingsSyncIncidentOverview(this.database, this.userId)
  }

  resolveIncident(
    input: unknown,
    recurring = false,
    allowSettings = false,
    allowPlans = false
  ) {
    return resolveLocalSyncIncident(
      this.database,
      this.userId,
      input,
      recurring,
      allowSettings,
      allowPlans
    ).then((result) => {
      if (result.status === "applied") notifyLocalOutboxChange(this.userId)
      return result
    })
  }

  resolvePlanOccurrenceIncident(input: unknown) {
    return resolveLocalPlanOccurrenceIncident(
      this.database,
      this.userId,
      input
    ).then((result) => {
      if (result.status === "applied") notifyLocalOutboxChange(this.userId)
      return result
    })
  }

  resolveSettingsIncident(input: unknown) {
    return resolveLocalSettingsIncident(this.database, this.userId, input).then(
      (result) => {
        if (result.status === "applied") notifyLocalOutboxChange(this.userId)
        return result
      }
    )
  }

  resolveTagIncident(input: unknown) {
    return resolveLocalTagIncident(this.database, this.userId, input).then(
      (result) => {
        if (result.status === "applied") notifyLocalOutboxChange(this.userId)
        return result
      }
    )
  }

  readPlacementIncidentSnapshot(operationId: string) {
    return readLocalPlacementResolutionSnapshot(
      this.database,
      this.userId,
      operationId
    )
  }
  resolvePlacementIncident(input: unknown) {
    return resolveLocalPlacementIncident(
      this.database,
      this.userId,
      input
    ).then((result) => {
      if (result.status === "applied") notifyLocalOutboxChange(this.userId)
      return result
    })
  }
  readTagDeletionIncidentSnapshot(operationId: string) {
    return readLocalTagDeletionResolutionSnapshot(
      this.database,
      this.userId,
      operationId
    )
  }
  resolveTagDeletionIncident(input: unknown) {
    return resolveLocalTagDeletionIncident(
      this.database,
      this.userId,
      input
    ).then((result) => {
      if (result.status === "applied") notifyLocalOutboxChange(this.userId)
      return result
    })
  }
  readTagOrderIncidentSnapshot(operationId: string) {
    return readLocalTagOrderResolutionSnapshot(
      this.database,
      this.userId,
      operationId
    )
  }
  resolveTagOrderIncident(input: unknown) {
    return resolveLocalTagOrderIncident(this.database, this.userId, input).then(
      (result) => {
        if (result.status === "applied") notifyLocalOutboxChange(this.userId)
        return result
      }
    )
  }
  readItemViewIncidentSnapshot(operationId: string) {
    return readLocalItemViewResolutionSnapshot(
      this.database,
      this.userId,
      operationId
    )
  }
  resolveItemViewIncident(input: unknown) {
    return resolveLocalItemViewIncident(this.database, this.userId, input).then(
      (result) => {
        if (result.status === "applied") notifyLocalOutboxChange(this.userId)
        return result
      }
    )
  }
  readPlanCategoryIncidentSnapshot(operationId: string) {
    return readLocalPlanCategoryResolutionSnapshot(
      this.database,
      this.userId,
      operationId
    )
  }

  resolvePlanCategoryIncident(input: unknown) {
    return resolveLocalPlanCategoryIncident(
      this.database,
      this.userId,
      input
    ).then((result) => {
      if (result.status === "applied") notifyLocalOutboxChange(this.userId)
      return result
    })
  }

  close() {
    this.database.close()
  }

  private ownRecord(input: unknown): CalendarItem | null {
    if (input === undefined) return null
    const item = calendarItemSchema.parse(input)
    if (item.ownerId !== this.userId)
      throw new Error("Sync record belongs to another account")
    return item
  }
  private ownEntry(input: unknown): OutboxEntry {
    const entry = outboxEntrySchema.parse(input)
    if (entry.userId !== this.userId)
      throw new Error("Sync operation belongs to another account")
    return entry
  }

  applyOperationResult(input: unknown): Promise<"applied" | "replayed"> {
    return this.applyItemResult(input, false)
  }

  // Prepared generation-five method; existing callers keep strict recurrence rejection.
  applyRecurringOperationResult(
    input: unknown
  ): Promise<"applied" | "replayed"> {
    return this.applyItemResult(
      validateLocalRecurringItemResult(input, this.userId),
      true
    )
  }

  private applyItemResult(
    input: unknown,
    allowSeries: boolean
  ): Promise<"applied" | "replayed"> {
    const submission = localSyncResultInputSchema.parse(input)
    const { operation, senderId, result } = submission
    const command = operation.command
    if (
      !("itemId" in command) ||
      command.type === "item-view.set" ||
      command.type === "task.move"
    )
      return Promise.reject(new Error("Sync result requires an item operation"))
    const entityKey = `item:${command.itemId}`
    const outcomeKey = `operation-outcome:${operation.operationId}`
    return runLocalTransaction(
      this.database,
      ["items", "outbox", "remoteShadows", "syncMetadata"],
      "readwrite",
      (context) => {
        const items = context.transaction.objectStore("items")
        const outbox = context.transaction.objectStore("outbox")
        const shadows = context.transaction.objectStore("remoteShadows")
        const metadata = context.transaction.objectStore("syncMetadata")
        const entryRequest = outbox.get(operation.operationId)
        const itemRequest = items.get(command.itemId)
        const shadowRequest = shadows.get(entityKey)
        const outcomeRequest = metadata.get(outcomeKey)
        const entriesRequest = outbox
          .index("byEntitySequence")
          .getAll(
            IDBKeyRange.bound(
              [entityKey, 0],
              [entityKey, Number.MAX_SAFE_INTEGER]
            )
          )
        let remaining = 5
        const finish = () => {
          if (--remaining) return
          try {
            const entry = this.ownEntry(entryRequest.result)
            if (JSON.stringify(entry.operation) !== JSON.stringify(operation))
              throw new Error("Submitted operation changed before its result")
            if (entry.state === "acknowledged") {
              const outcome = readItemOutcome(
                outcomeRequest.result,
                this.userId
              )
              if (
                JSON.stringify(outcome.operation) !==
                  JSON.stringify(operation) ||
                JSON.stringify(outcome.result) !== JSON.stringify(result)
              )
                throw new Error(
                  "Acknowledged result does not match its durable outcome"
                )
              context.setResult("replayed")
              return
            }
            if (entry.state !== "sending" || entry.lease?.ownerId !== senderId)
              throw new Error("Sync sender no longer owns the operation lease")
            const local = this.ownRecord(itemRequest.result)
            const base =
              shadowRequest.result === undefined
                ? null
                : this.ownRecord(
                    readItemShadow(shadowRequest.result, this.userId).record
                  )
            const entries = entriesRequest.result.map((value) =>
              this.ownEntry(value)
            )
            const state =
              result.status === "applied"
                ? "acknowledged"
                : result.status === "conflict"
                  ? "conflict"
                  : result.status === "unsupported"
                    ? "pending"
                    : "rejected"
            const nextEntry = this.ownEntry({ ...entry, state, lease: null })
            const nextEntries = entries.map((candidate) => {
              if (candidate.operation.operationId === operation.operationId)
                return nextEntry
              if (
                result.status === "applied" &&
                candidate.state === "pending" &&
                candidate.attempts === 0 &&
                candidate.dependencies.includes(operation.operationId)
              )
                return this.ownEntry({
                  ...candidate,
                  operation: {
                    ...candidate.operation,
                    baseRevision: result.item.revision,
                  },
                })
              return candidate
            })
            let nextLocal = local
            let nextShadow = base
            const incoming =
              result.status === "applied"
                ? result.item
                : result.status === "conflict"
                  ? result.current
                  : null
            if (incoming) {
              if (
                incoming.id !== command.itemId ||
                incoming.ownerId !== this.userId
              )
                throw new Error(
                  "Result item does not match its operation and account"
                )
              if (result.status === "applied") {
                if (
                  incoming.kind === "birthday" ||
                  (incoming.recurrence &&
                    !(allowSeries && incoming.kind === "plan")) ||
                  command.type === "task.update-occurrence" ||
                  command.type === "task.cancel-occurrence" ||
                  ((command.type === "task.set-status" ||
                    command.type === "task.set-checklist-entry") &&
                    command.occurrenceId !== null)
                )
                  throw new Error(
                    "Applied response uses an unsupported item mutation"
                  )
                if (incoming.revision !== operation.baseRevision + 1)
                  throw new Error(
                    "Applied revision does not follow its submitted base"
                  )
                if (
                  ((command.type === "item.create" ||
                    command.type === "item.update") &&
                    incoming.kind !== command.input.kind) ||
                  ((command.type === "task.set-status" ||
                    command.type === "task.set-checklist-entry") &&
                    incoming.kind !== "task") ||
                  (command.type === "item.delete") !==
                    Boolean(incoming.deletedAt)
                )
                  throw new Error(
                    "Applied item kind or deletion does not match its command"
                  )
              }
              const projection = planRemoteItemProjection({
                userId: this.userId,
                local,
                shadow: base,
                incoming,
                entries: nextEntries,
              })
              nextShadow = projection.shadow
              nextLocal = projection.local
              if (
                result.status === "applied" &&
                projection.pending &&
                nextLocal
              )
                nextLocal = calendarItemSchema.parse({
                  ...nextLocal,
                  revision: nextShadow.revision,
                  createdAt: nextShadow.createdAt,
                })
            }
            for (const candidate of nextEntries) outbox.put(candidate)
            if (nextLocal) items.put(nextLocal)
            if (nextShadow)
              shadows.put(
                remoteShadowSchema.parse({ entityKey, record: nextShadow })
              )
            metadata.put(
              localOperationOutcomeSchema.parse({
                key: outcomeKey,
                operation,
                result,
                local,
                base,
              })
            )
            context.setResult("applied")
          } catch (error) {
            context.fail(error)
          }
        }
        for (const request of [
          entryRequest,
          itemRequest,
          shadowRequest,
          outcomeRequest,
          entriesRequest,
        ])
          request.onsuccess = finish
      }
    )
  }
}
