"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import { planLocalPlanMove } from "@/lib/local-db/plan-move-mutation"
import { planLocalRecurringPlanMove } from "@/lib/local-db/recurring-plan-move"
import { parseLocalRecord } from "@/lib/local-db/store-config"
import {
  planLocalTaskMove,
  type TaskMoveCommand,
} from "@/lib/local-db/task-move-mutation"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import {
  outboxEntrySchema,
  outboxSequenceSchema,
  preferenceTailSchema,
} from "@/schemas/local-sync"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { syncCommandSchema } from "@/schemas/sync"
import type { OutboxEntry } from "@/types/local-sync"

export function commitLocalTaskMoveCommand(
  database: IDBDatabase,
  userId: string,
  input: TaskMoveCommand,
  options: { operationId?: string; now?: Date },
  allowPlans = false
): Promise<OutboxEntry> {
  return commitTaskMoveCommand(
    database,
    userId,
    input,
    options,
    allowPlans,
    false
  )
}

// Prepared recurring producer; current hooks keep the existing strict entry point.
export function commitLocalRecurringPlanMoveCommand(
  database: IDBDatabase,
  userIdInput: unknown,
  input: TaskMoveCommand,
  options: { operationId?: string; now?: Date }
): Promise<OutboxEntry> {
  const userId = userIdSchema.parse(userIdInput)
  if (database.name !== localDatabaseName(userId))
    return Promise.reject(
      new Error("Movement database belongs to another partition")
    )
  return commitTaskMoveCommand(database, userId, input, options, true, true)
}

function commitTaskMoveCommand(
  database: IDBDatabase,
  userId: string,
  input: TaskMoveCommand,
  options: { operationId?: string; now?: Date },
  allowPlans: boolean,
  allowSeries: boolean
): Promise<OutboxEntry> {
  const parsed = syncCommandSchema.parse(input)
  if (
    parsed.type !== "task.move" ||
    (!allowSeries && parsed.occurrenceId !== null && parsed.scope !== "day")
  )
    return Promise.reject(
      new Error("Occurrence movement requires its own mutation layer")
    )
  const command = parsed
  const operationId = entityIdSchema.parse(
    options.operationId ?? crypto.randomUUID()
  )
  const timestamp = timestampSchema.parse(
    (options.now ?? new Date()).toISOString()
  )
  const entityKey = taskPlacementEntityKey(
    command.occurrenceId ?? command.itemId,
    command.scope,
    command.date
  )
  function parseEntry(value: unknown) {
    const entry = outboxEntrySchema.parse(value)
    if (entry.userId !== userId)
      throw new Error("Operation belongs to another account")
    return entry
  }
  return runLocalTransaction(
    database,
    [
      "items",
      "occurrences",
      "tags",
      "itemViews",
      "taskPlacements",
      "settings",
      "outbox",
      "syncMetadata",
    ],
    "readwrite",
    (context) => {
      const store = (name: string) => context.transaction.objectStore(name)
      const outbox = store("outbox")
      const metadata = store("syncMetadata")
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
          const limit = allowSeries ? 10001 : undefined
          const items = store("items").getAll(undefined, limit)
          const occurrences = store("occurrences").getAll(undefined, limit)
          const tags = store("tags").getAll(undefined, limit)
          const views = store("itemViews").getAll(undefined, limit)
          const placements = store("taskPlacements").getAll(undefined, limit)
          const settings = store("settings").get(userId)
          const sequence = metadata.get("outbox-sequence")
          const tail = metadata.get("preference-tail")
          function previousOperation(key: string) {
            return outbox
              .index("byEntitySequence")
              .openCursor(
                IDBKeyRange.bound([key, 0], [key, Number.MAX_SAFE_INTEGER]),
                "prev"
              )
          }
          const previous = previousOperation(entityKey)
          const itemPrevious = previousOperation(`item:${command.itemId}`)
          let tailEntry: OutboxEntry | null = null
          let remaining = 10
          function finish() {
            if (--remaining !== 0) return
            try {
              const result = (
                allowSeries
                  ? planLocalRecurringPlanMove
                  : allowPlans
                    ? planLocalPlanMove
                    : planLocalTaskMove
              )(
                {
                  items: items.result.map((value) =>
                    parseLocalRecord("items", value, userId)
                  ),
                  occurrences: occurrences.result.map((value) =>
                    parseLocalRecord("occurrences", value, userId)
                  ),
                  tags: tags.result.map((value) =>
                    parseLocalRecord("tags", value, userId)
                  ),
                  views: views.result.map((value) =>
                    parseLocalRecord("itemViews", value, userId)
                  ),
                  placements: placements.result.map((value) =>
                    parseLocalRecord("taskPlacements", value, userId)
                  ),
                  settings:
                    settings.result === undefined
                      ? null
                      : parseLocalRecord("settings", settings.result, userId),
                },
                command,
                userId,
                timestamp
              )
              const nextSequence =
                sequence.result === undefined
                  ? 1
                  : outboxSequenceSchema.parse(sequence.result).value + 1
              const dependencies = [
                tailEntry,
                previous.result ? parseEntry(previous.result.value) : null,
                itemPrevious.result
                  ? parseEntry(itemPrevious.result.value)
                  : null,
              ].filter(
                (entry): entry is OutboxEntry =>
                  entry !== null && isUnresolvedOutboxEntry(entry)
              )
              const entry = parseEntry({
                userId,
                entityKey,
                sequence: nextSequence,
                operation: {
                  operationId,
                  protocolVersion: 1,
                  baseRevision: result.current?.revision ?? 0,
                  command,
                },
                dependencies: [
                  ...new Set(
                    dependencies.map((entry) => entry.operation.operationId)
                  ),
                ],
                state: "pending",
                attempts: 0,
                createdAt: timestamp,
                lease: null,
              })
              for (const placement of result.placements)
                store("taskPlacements").put(placement)
              if (result.view) store("itemViews").put(result.view)
              outbox.add(entry)
              metadata.put(
                outboxSequenceSchema.parse({
                  key: "outbox-sequence",
                  value: nextSequence,
                })
              )
              metadata.put(
                preferenceTailSchema.parse({
                  key: "preference-tail",
                  operationId,
                })
              )
              context.setResult(entry)
            } catch (error) {
              context.fail(error)
            }
          }
          for (const request of [
            items,
            occurrences,
            tags,
            views,
            placements,
            settings,
            sequence,
            previous,
            itemPrevious,
          ])
            request.onsuccess = finish
          tail.onsuccess = () => {
            try {
              if (tail.result === undefined) {
                finish()
                return
              }
              const request = outbox.get(
                preferenceTailSchema.parse(tail.result).operationId
              )
              request.onsuccess = () => {
                try {
                  if (request.result === undefined)
                    throw new Error("Preference dependency is missing")
                  tailEntry = parseEntry(request.result)
                  finish()
                } catch (error) {
                  context.fail(error)
                }
              }
            } catch (error) {
              context.fail(error)
            }
          }
        } catch (error) {
          context.fail(error)
        }
      }
    }
  )
}
