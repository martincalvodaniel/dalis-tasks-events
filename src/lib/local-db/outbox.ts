"use client"

import { openLocalDatabase } from "@/lib/local-db/client"
import { applyLocalItemCommand } from "@/lib/local-db/item-mutation"
import { commitLocalTaskOccurrenceCommand } from "@/lib/local-db/occurrence-outbox"
import { commitLocalPreferenceCommand } from "@/lib/local-db/preference-outbox"
import { parseLocalRecord } from "@/lib/local-db/store-config"
import { notifyLocalOutboxChange } from "@/lib/local-db/sync-notifications"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import { calendarItemSchema } from "@/schemas/calendar-item"
import {
  outboxEntrySchema,
  outboxSequenceSchema,
  remoteShadowSchema,
} from "@/schemas/local-sync"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { syncCommandSchema } from "@/schemas/sync"
import type { CalendarItem, ItemOccurrence } from "@/types/calendar-item"
import type {
  LocalItemCommand,
  LocalOccurrenceCommand,
  LocalPreferenceCommand,
  OutboxEntry,
  RemoteShadow,
} from "@/types/local-sync"
import type { Tag } from "@/types/preferences"

type ItemCommitOptions = {
  operationId?: string
  now?: Date
  expectedItem?: CalendarItem
}

export class LocalOutbox {
  private constructor(
    readonly userId: string,
    private readonly database: IDBDatabase
  ) {}

  static async open(userId: string): Promise<LocalOutbox> {
    const actor = userIdSchema.parse(userId)
    return new LocalOutbox(actor, await openLocalDatabase(actor))
  }

  close(): void {
    this.database.close()
  }

  private parseEntry(value: unknown): OutboxEntry {
    const entry = outboxEntrySchema.parse(value)
    if (entry.userId !== this.userId)
      throw new Error("Operation belongs to another account")
    return entry
  }

  commitItemCommand(
    input: LocalItemCommand,
    options: ItemCommitOptions = {}
  ): Promise<OutboxEntry> {
    return this.commitItemRecord(input, options).then((entry) =>
      this.notifyCommitted(entry)
    )
  }
  private notifyCommitted(entry: OutboxEntry): OutboxEntry {
    notifyLocalOutboxChange(this.userId)
    return entry
  }
  private commitItemRecord(
    input: LocalItemCommand,
    options: ItemCommitOptions
  ): Promise<OutboxEntry> {
    const parsed = syncCommandSchema.parse(input)
    if (
      parsed.type !== "item.create" &&
      parsed.type !== "item.update" &&
      parsed.type !== "item.delete" &&
      parsed.type !== "task.set-status" &&
      parsed.type !== "task.set-checklist-entry"
    ) {
      return Promise.reject(
        new Error("Command requires its domain mutation layer")
      )
    }
    if (
      (parsed.type === "task.set-status" ||
        parsed.type === "task.set-checklist-entry") &&
      parsed.occurrenceId !== null
    )
      return commitLocalTaskOccurrenceCommand(
        this.database,
        this.userId,
        parsed,
        options
      )
    const command = parsed
    const expected = options.expectedItem
      ? calendarItemSchema.parse(options.expectedItem)
      : undefined
    if (expected && expected.id !== command.itemId)
      return Promise.reject(
        new Error("Expected item does not match the command")
      )
    const operationId = entityIdSchema.parse(
      options.operationId ?? crypto.randomUUID()
    )
    const timestamp = timestampSchema.parse(
      (options.now ?? new Date()).toISOString()
    )
    const entityKey = `item:${command.itemId}`
    return runLocalTransaction(
      this.database,
      ["items", "outbox", "syncMetadata"],
      "readwrite",
      (context) => {
        const items = context.transaction.objectStore("items")
        const outbox = context.transaction.objectStore("outbox")
        const metadata = context.transaction.objectStore("syncMetadata")
        const existingRequest = outbox.get(operationId)
        existingRequest.onsuccess = () => {
          try {
            if (existingRequest.result !== undefined) {
              const existing = this.parseEntry(existingRequest.result)
              if (
                JSON.stringify(existing.operation.command) !==
                JSON.stringify(command)
              )
                throw new Error(
                  "Operation ID was reused with a different command"
                )
              context.setResult(existing)
              return
            }
            const itemRequest = items.get(command.itemId)
            const sequenceRequest = metadata.get("outbox-sequence")
            const previousRequest = outbox
              .index("byEntitySequence")
              .openCursor(
                IDBKeyRange.bound(
                  [entityKey, 0],
                  [entityKey, Number.MAX_SAFE_INTEGER]
                ),
                "prev"
              )
            let completed = 0
            const finish = () => {
              if (++completed !== 3) return
              try {
                const current =
                  itemRequest.result === undefined
                    ? null
                    : parseLocalRecord("items", itemRequest.result, this.userId)
                if (
                  expected &&
                  JSON.stringify(current) !== JSON.stringify(expected)
                )
                  throw new Error("Item changed since the editor was opened")
                const sequence =
                  sequenceRequest.result === undefined
                    ? 1
                    : outboxSequenceSchema.parse(sequenceRequest.result).value +
                      1
                const previous = previousRequest.result
                  ? this.parseEntry(previousRequest.result.value)
                  : null
                const record = applyLocalItemCommand(
                  current,
                  command,
                  this.userId,
                  timestamp
                )
                const entry = this.parseEntry({
                  userId: this.userId,
                  entityKey,
                  sequence,
                  operation: {
                    operationId,
                    protocolVersion: 1,
                    baseRevision: current?.revision ?? 0,
                    command,
                  },
                  dependencies:
                    previous && isUnresolvedOutboxEntry(previous)
                      ? [previous.operation.operationId]
                      : [],
                  state: "pending",
                  attempts: 0,
                  createdAt: timestamp,
                  lease: null,
                })
                items.put(record)
                outbox.add(entry)
                metadata.put(
                  outboxSequenceSchema.parse({
                    key: "outbox-sequence",
                    value: sequence,
                  })
                )
                context.setResult(entry)
              } catch (error) {
                context.fail(error)
              }
            }
            itemRequest.onsuccess = finish
            sequenceRequest.onsuccess = finish
            previousRequest.onsuccess = finish
          } catch (error) {
            context.fail(error)
          }
        }
      }
    )
  }

  commitOccurrenceCommand(
    input: LocalOccurrenceCommand,
    options: {
      operationId?: string
      now?: Date
      expectedItem: CalendarItem
      expectedOccurrence: ItemOccurrence
    }
  ): Promise<OutboxEntry> {
    return commitLocalTaskOccurrenceCommand(
      this.database,
      this.userId,
      input,
      options
    ).then((entry) => this.notifyCommitted(entry))
  }

  listEntries(): Promise<OutboxEntry[]> {
    return runLocalTransaction(
      this.database,
      ["outbox"],
      "readonly",
      (context) => {
        const request = context.transaction
          .objectStore("outbox")
          .index("bySequence")
          .getAll()
        request.onsuccess = () => {
          try {
            context.setResult(
              request.result.map((value) => this.parseEntry(value))
            )
          } catch (error) {
            context.fail(error)
          }
        }
      }
    )
  }

  commitPreferenceCommand(
    input: LocalPreferenceCommand,
    options: { operationId?: string; now?: Date; expectedTag?: Tag } = {}
  ): Promise<OutboxEntry> {
    return commitLocalPreferenceCommand(
      this.database,
      this.userId,
      input,
      options
    ).then((entry) => this.notifyCommitted(entry))
  }

  getShadow(itemId: string): Promise<RemoteShadow | null> {
    const entityKey = `item:${entityIdSchema.parse(itemId)}`
    return runLocalTransaction(
      this.database,
      ["remoteShadows"],
      "readonly",
      (context) => {
        const request = context.transaction
          .objectStore("remoteShadows")
          .get(entityKey)
        request.onsuccess = () => {
          try {
            context.setResult(
              request.result === undefined
                ? null
                : remoteShadowSchema.parse(request.result)
            )
          } catch (error) {
            context.fail(error)
          }
        }
      }
    )
  }

  claim(
    operationId: string,
    ownerId: string,
    now = new Date(),
    durationMs = 30000
  ): Promise<OutboxEntry | null> {
    const id = entityIdSchema.parse(operationId)
    const owner = entityIdSchema.parse(ownerId)
    if (
      !Number.isSafeInteger(durationMs) ||
      durationMs < 1000 ||
      durationMs > 120000
    )
      return Promise.reject(new RangeError("Invalid lease duration"))
    const expiresAt = timestampSchema.parse(
      new Date(now.getTime() + durationMs).toISOString()
    )
    return runLocalTransaction(
      this.database,
      ["outbox"],
      "readwrite",
      (context) => {
        const store = context.transaction.objectStore("outbox")
        const request = store.get(id)
        request.onsuccess = () => {
          try {
            if (request.result === undefined) {
              context.setResult(null)
              return
            }
            const entry = this.parseEntry(request.result)
            if (entry.state !== "pending") {
              context.setResult(null)
              return
            }
            const finish = () => {
              const claimed = this.parseEntry({
                ...entry,
                state: "sending",
                attempts: entry.attempts + 1,
                lease: { ownerId: owner, expiresAt },
              })
              store.put(claimed)
              context.setResult(claimed)
            }
            if (!entry.dependencies.length) {
              finish()
              return
            }
            let remaining = entry.dependencies.length
            let ready = true
            for (const dependencyId of entry.dependencies) {
              const dependency = store.get(dependencyId)
              dependency.onsuccess = () => {
                try {
                  if (
                    dependency.result === undefined ||
                    this.parseEntry(dependency.result).state !== "acknowledged"
                  )
                    ready = false
                  if (--remaining === 0) {
                    if (ready) finish()
                    else context.setResult(null)
                  }
                } catch (error) {
                  context.fail(error)
                }
              }
            }
          } catch (error) {
            context.fail(error)
          }
        }
      }
    )
  }

  release(operationId: string, ownerId: string): Promise<boolean> {
    const id = entityIdSchema.parse(operationId)
    const owner = entityIdSchema.parse(ownerId)
    return runLocalTransaction(
      this.database,
      ["outbox"],
      "readwrite",
      (context) => {
        const store = context.transaction.objectStore("outbox")
        const request = store.get(id)
        request.onsuccess = () => {
          try {
            if (request.result === undefined) {
              context.setResult(false)
              return
            }
            const entry = this.parseEntry(request.result)
            if (entry.state !== "sending" || entry.lease?.ownerId !== owner) {
              context.setResult(false)
              return
            }
            store.put(
              this.parseEntry({ ...entry, state: "pending", lease: null })
            )
            context.setResult(true)
          } catch (error) {
            context.fail(error)
          }
        }
      }
    )
  }

  recoverExpiredSends(now = new Date()): Promise<number> {
    const timestamp = timestampSchema.parse(now.toISOString())
    return runLocalTransaction(
      this.database,
      ["outbox"],
      "readwrite",
      (context) => {
        const store = context.transaction.objectStore("outbox")
        const request = store.index("byState").getAll("sending")
        request.onsuccess = () => {
          try {
            let recovered = 0
            for (const value of request.result) {
              const entry = this.parseEntry(value)
              if (entry.lease && entry.lease.expiresAt <= timestamp) {
                store.put(
                  this.parseEntry({ ...entry, state: "pending", lease: null })
                )
                recovered++
              }
            }
            context.setResult(recovered)
          } catch (error) {
            context.fail(error)
          }
        }
      }
    )
  }
}
