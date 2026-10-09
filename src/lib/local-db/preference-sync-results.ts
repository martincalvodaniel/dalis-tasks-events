"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { validateLocalSyncResultInputV2 } from "@/lib/sync/local-sync-result-v2"
import { planLocalPreferenceResult } from "@/lib/sync/preference-result-plan"
import { decodeRemoteShadow } from "@/lib/sync/remote-shadow-v2"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import {
  itemViewSchema,
  tagSchema,
  taskPlacementSchema,
} from "@/schemas/preferences"
import { userIdSchema } from "@/schemas/primitives"

// Account epoch checks belong to the caller; this transaction protects one account partition.
export function applyLocalPreferenceResult(
  database: IDBDatabase,
  userIdInput: unknown,
  input: unknown
): Promise<"applied" | "replayed"> {
  const userId = userIdSchema.parse(userIdInput)
  if (database.name !== localDatabaseName(userId))
    return Promise.reject(
      new Error("Personal result database belongs to another partition")
    )
  const submission = validateLocalSyncResultInputV2(input, userId)
  if (
    submission.result.kind !== "preference" ||
    ![
      "tag.save",
      "tag.delete",
      "tag.move",
      "item-view.set",
      "task.move",
    ].includes(submission.operation.command.type)
  )
    return Promise.reject(
      new Error("Personal result application does not support this command")
    )
  const result = submission.result.outcome
  const effects =
    result.status === "applied"
      ? result.effects.effects
      : result.status === "conflict"
        ? [result.current]
        : []
  if (
    effects.some(
      (effect) =>
        effect.store !== "tags" &&
        effect.store !== "itemViews" &&
        effect.store !== "taskPlacements"
    )
  )
    return Promise.reject(
      new Error(
        "Personal result application does not support this effect store"
      )
    )
  return runLocalTransaction(
    database,
    [
      "tags",
      "itemViews",
      "taskPlacements",
      "outbox",
      "remoteShadows",
      "syncMetadata",
    ],
    "readwrite",
    (context) => {
      const tags = context.transaction.objectStore("tags")
      const views = context.transaction.objectStore("itemViews")
      const placements = context.transaction.objectStore("taskPlacements")
      const outbox = context.transaction.objectStore("outbox")
      const shadows = context.transaction.objectStore("remoteShadows")
      const metadata = context.transaction.objectStore("syncMetadata")
      const requests = {
        tags: tags.getAll(undefined, 10001),
        views: views.getAll(undefined, 10001),
        placements: placements.getAll(undefined, 10001),
        entries: outbox.getAll(undefined, 10001),
        shadows: shadows.getAll(undefined, 10001),
        outcome: metadata.get(
          `operation-outcome:${submission.operation.operationId}`
        ),
      }
      let remaining = 6
      function finish() {
        if (--remaining) return
        try {
          const plan = planLocalPreferenceResult({
            userId,
            submission,
            local: [
              ...requests.tags.result.map((input: unknown) => {
                const record = tagSchema.parse(input)
                return {
                  entityKey: `tag:${record.id}`,
                  record: { store: "tags", record },
                }
              }),
              ...requests.views.result.map((input: unknown) => {
                const record = itemViewSchema.parse(input)
                return {
                  entityKey: `item-view:${record.itemId}`,
                  record: { store: "itemViews", record },
                }
              }),
              ...requests.placements.result.map((input: unknown) => {
                const record = taskPlacementSchema.parse(input)
                return {
                  entityKey: taskPlacementEntityKey(
                    record.occurrenceId,
                    record.scope,
                    record.date
                  ),
                  record: { store: "taskPlacements", record },
                }
              }),
            ],
            shadows: requests.shadows.result.map((record: unknown) =>
              decodeRemoteShadow(record, userId)
            ),
            entries: requests.entries.result,
            existingOutcome: requests.outcome.result ?? null,
          })
          if (plan.status === "replayed") {
            context.setResult("replayed")
            return
          }
          for (const entry of plan.local) {
            if (entry.record?.store === "tags") tags.put(entry.record.record)
            else if (entry.record?.store === "itemViews")
              views.put(entry.record.record)
            else if (entry.record?.store === "taskPlacements")
              placements.put(entry.record.record)
          }
          for (const shadow of plan.shadows) shadows.put(shadow)
          const previous = new Map(
            requests.entries.result.map((entry) => [
              entry.operation.operationId,
              JSON.stringify(entry),
            ])
          )
          for (const entry of plan.entries)
            if (
              previous.get(entry.operation.operationId) !==
              JSON.stringify(entry)
            )
              outbox.put(entry)
          metadata.put(plan.outcome)
          context.setResult("applied")
        } catch (error) {
          context.fail(error)
        }
      }
      for (const request of Object.values(requests)) request.onsuccess = finish
    }
  )
}
