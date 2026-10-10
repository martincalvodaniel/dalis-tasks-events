"use client"

import type { z } from "zod"
import {
  applyPlanOccurrenceCommand,
  editablePlanOccurrence,
} from "@/lib/calendar/plan-occurrence-command"
import { parseLocalRecord } from "@/lib/local-db/store-config"
import { notifyLocalOutboxChange } from "@/lib/local-db/sync-notifications"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import { outboxEntrySchema, outboxSequenceSchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import { planOccurrenceCommandSchema } from "@/schemas/plan-occurrence-command"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import type { OutboxEntry } from "@/types/local-sync"
import type { Plan } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"

export type PlanOccurrenceCommitOptions = {
  operationId?: string
  now?: Date
  expectedItem: Plan
  expectedOccurrence: PlanOccurrence
}

export function commitLocalPlanOccurrenceCommand(
  database: IDBDatabase,
  userId: string,
  input: z.infer<typeof planOccurrenceCommandSchema>,
  options: PlanOccurrenceCommitOptions
): Promise<OutboxEntry> {
  const actor = userIdSchema.parse(userId)
  const command = planOccurrenceCommandSchema.parse(input)
  const expected = planSchema.parse(options.expectedItem)
  const expectedOccurrence = planOccurrenceSchema.parse(
    options.expectedOccurrence
  )
  if (
    expected.id !== command.itemId ||
    expectedOccurrence.seriesId !== command.itemId ||
    expectedOccurrence.id !== command.occurrenceId
  )
    throw new Error("Expected plan snapshots do not match the command")
  const operationId = entityIdSchema.parse(
    options.operationId ?? crypto.randomUUID()
  )
  const timestamp = timestampSchema.parse(
    (options.now ?? new Date()).toISOString()
  )
  const entityKey = `item:${command.itemId}`
  function parseEntry(value: unknown): OutboxEntry {
    const entry = outboxEntrySchema.parse(value)
    if (entry.userId !== actor)
      throw new Error("Operation belongs to another account")
    return entry
  }
  return runLocalTransaction<OutboxEntry>(
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
          const item = items.get(command.itemId)
          const occurrence = occurrences.get(command.occurrenceId)
          const sequence = metadata.get("outbox-sequence")
          const previous = outbox
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
              const parent =
                item.result === undefined
                  ? null
                  : parseLocalRecord("items", item.result, actor)
              if (JSON.stringify(parent) !== JSON.stringify(expected))
                throw new Error("Plan changed since the editor was opened")
              if (parent?.kind !== "plan")
                throw new Error("Occurrence mutation requires a common plan")
              const stored =
                occurrence.result === undefined
                  ? null
                  : parseLocalRecord("occurrences", occurrence.result, actor)
              if (stored && stored.kind !== "plan")
                throw new Error("Occurrence does not belong to a common plan")
              const editable = editablePlanOccurrence(
                parent,
                stored,
                command,
                actor
              )
              if (
                JSON.stringify(editable.current) !==
                JSON.stringify(expectedOccurrence)
              )
                throw new Error(
                  "Plan occurrence changed since the editor was opened"
                )
              const record = applyPlanOccurrenceCommand(
                parent,
                stored,
                command,
                actor,
                timestamp
              )
              const value =
                sequence.result === undefined
                  ? 1
                  : outboxSequenceSchema.parse(sequence.result).value + 1
              const previousEntry = previous.result
                ? parseEntry(previous.result.value)
                : null
              const entry = parseEntry({
                userId: actor,
                entityKey,
                sequence: value,
                operation: {
                  operationId,
                  protocolVersion: 1,
                  baseRevision: parent.revision,
                  command,
                },
                dependencies:
                  previousEntry && isUnresolvedOutboxEntry(previousEntry)
                    ? [previousEntry.operation.operationId]
                    : [],
                state: "pending",
                attempts: 0,
                createdAt: timestamp,
                lease: null,
              })
              occurrences.put(record)
              outbox.add(entry)
              metadata.put(
                outboxSequenceSchema.parse({ key: "outbox-sequence", value })
              )
              context.setResult(entry)
            } catch (error) {
              context.fail(error)
            }
          }
          item.onsuccess = finish
          occurrence.onsuccess = finish
          sequence.onsuccess = finish
          previous.onsuccess = finish
        } catch (error) {
          context.fail(error)
        }
      }
    }
  ).then((entry) => {
    notifyLocalOutboxChange(actor)
    return entry
  })
}
