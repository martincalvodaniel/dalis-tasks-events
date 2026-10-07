"use client"

import { applyLocalOccurrenceCommand } from "@/lib/local-db/occurrence-mutation"
import {
  applyLocalOccurrenceProgress,
  type OccurrenceProgressCommand,
} from "@/lib/local-db/occurrence-progress"
import { parseLocalRecord } from "@/lib/local-db/store-config"
import { editableTaskOccurrence } from "@/lib/local-db/task-occurrence"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { outboxEntrySchema, outboxSequenceSchema } from "@/schemas/local-sync"
import { itemOccurrenceSchema } from "@/schemas/occurrence"
import { entityIdSchema, timestampSchema } from "@/schemas/primitives"
import { syncCommandSchema } from "@/schemas/sync"
import type { CalendarItem, ItemOccurrence } from "@/types/calendar-item"
import type { LocalOccurrenceCommand, OutboxEntry } from "@/types/local-sync"

export function commitLocalTaskOccurrenceCommand(
  database: IDBDatabase,
  userId: string,
  input: OccurrenceProgressCommand | LocalOccurrenceCommand,
  options: {
    operationId?: string
    now?: Date
    expectedItem?: CalendarItem
    expectedOccurrence?: ItemOccurrence
  }
): Promise<OutboxEntry> {
  const command = syncCommandSchema.parse(input)
  if (
    (command.type !== "task.set-status" &&
      command.type !== "task.set-checklist-entry" &&
      command.type !== "task.update-occurrence" &&
      command.type !== "task.cancel-occurrence") ||
    !command.occurrenceId
  )
    return Promise.reject(
      new Error("Command requires task occurrence mutation")
    )
  const occurrenceCommand = command
  const occurrenceId = command.occurrenceId
  const expected = options.expectedItem
    ? calendarItemSchema.parse(options.expectedItem)
    : undefined
  if (expected && expected.id !== command.itemId)
    return Promise.reject(
      new Error("Expected series does not match the command")
    )
  const expectedOccurrence = options.expectedOccurrence
    ? itemOccurrenceSchema.parse(options.expectedOccurrence)
    : undefined
  if (
    expectedOccurrence &&
    (expectedOccurrence.id !== occurrenceId ||
      expectedOccurrence.seriesId !== command.itemId)
  )
    return Promise.reject(
      new Error("Expected occurrence does not match the command")
    )
  if (
    (command.type === "task.update-occurrence" ||
      command.type === "task.cancel-occurrence") &&
    (!expected || !expectedOccurrence)
  )
    return Promise.reject(
      new Error("Occurrence editing requires series and occurrence snapshots")
    )
  const operationId = entityIdSchema.parse(
    options.operationId ?? crypto.randomUUID()
  )
  const timestamp = timestampSchema.parse(
    (options.now ?? new Date()).toISOString()
  )
  const entityKey = `item:${command.itemId}`
  function parseEntry(value: unknown): OutboxEntry {
    const entry = outboxEntrySchema.parse(value)
    if (entry.userId !== userId)
      throw new Error("Operation belongs to another account")
    return entry
  }
  return runLocalTransaction(
    database,
    ["items", "occurrences", "outbox", "syncMetadata"],
    "readwrite",
    (context) => {
      const items = context.transaction.objectStore("items")
      const occurrences = context.transaction.objectStore("occurrences")
      const outbox = context.transaction.objectStore("outbox")
      const metadata = context.transaction.objectStore("syncMetadata")
      const replay = outbox.get(operationId)
      replay.onsuccess = () => {
        try {
          if (replay.result !== undefined) {
            const existing = parseEntry(replay.result)
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
          const seriesRequest = items.get(command.itemId)
          const occurrenceRequest = occurrences.get(occurrenceId)
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
          let remaining = 4
          function finish() {
            if (--remaining) return
            try {
              const series =
                seriesRequest.result === undefined
                  ? null
                  : parseLocalRecord("items", seriesRequest.result, userId)
              if (
                expected &&
                JSON.stringify(series) !== JSON.stringify(expected)
              )
                throw new Error("Series changed since the editor was opened")
              const current =
                occurrenceRequest.result === undefined
                  ? null
                  : parseLocalRecord(
                      "occurrences",
                      occurrenceRequest.result,
                      userId
                    )
              if (expectedOccurrence) {
                const editable = editableTaskOccurrence(
                  series,
                  current,
                  occurrenceId,
                  occurrenceCommand.itemId,
                  userId
                )
                if (
                  JSON.stringify(editable.current) !==
                  JSON.stringify(expectedOccurrence)
                )
                  throw new Error(
                    "Occurrence changed since the editor was opened"
                  )
              }
              const record =
                occurrenceCommand.type === "task.update-occurrence" ||
                occurrenceCommand.type === "task.cancel-occurrence"
                  ? applyLocalOccurrenceCommand(
                      series,
                      current,
                      occurrenceCommand,
                      userId,
                      timestamp
                    )
                  : applyLocalOccurrenceProgress(
                      series,
                      current,
                      occurrenceCommand,
                      userId,
                      timestamp
                    )
              const sequence =
                sequenceRequest.result === undefined
                  ? 1
                  : outboxSequenceSchema.parse(sequenceRequest.result).value + 1
              const previous = previousRequest.result
                ? parseEntry(previousRequest.result.value)
                : null
              const entry = parseEntry({
                userId,
                entityKey,
                sequence,
                operation: {
                  operationId,
                  protocolVersion: 1,
                  baseRevision: series?.revision ?? 0,
                  command,
                },
                dependencies:
                  previous && previous.state !== "acknowledged"
                    ? [previous.operation.operationId]
                    : [],
                state: "pending",
                attempts: 0,
                createdAt: timestamp,
                lease: null,
              })
              occurrences.put(record)
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
          seriesRequest.onsuccess = finish
          occurrenceRequest.onsuccess = finish
          sequenceRequest.onsuccess = finish
          previousRequest.onsuccess = finish
        } catch (error) {
          context.fail(error)
        }
      }
    }
  )
}
