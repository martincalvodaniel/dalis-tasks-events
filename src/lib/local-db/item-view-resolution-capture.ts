"use client"

import type { z } from "zod"
import { localDatabaseName } from "@/lib/local-db/client"
import { queueLocalSettingsIncidentOverview } from "@/lib/local-db/sync-incidents"
import {
  type LocalTransactionContext,
  runLocalTransaction,
} from "@/lib/local-db/transaction"
import { captureItemViewResolutionSnapshot } from "@/lib/sync/item-view-resolution"
import { decodeLocalRecurringOutcome } from "@/lib/sync/local-recurring-outcome"
import { itemViewResolutionCaptureSchema } from "@/schemas/item-view-resolution"
import { planSchema } from "@/schemas/plan-item"
import { tagSchema } from "@/schemas/preferences"
import { entityIdSchema, userIdSchema } from "@/schemas/primitives"
import type { ItemViewResolutionSnapshot } from "@/types/item-view-resolution"

export const itemViewResolutionStoreNames = [
  "settings",
  "items",
  "occurrences",
  "tags",
  "itemViews",
  "taskPlacements",
  "remoteShadows",
  "outbox",
  "syncMetadata",
]
export function queueLocalItemViewResolutionCapture(
  context: Pick<LocalTransactionContext<unknown>, "transaction" | "fail">,
  userIdInput: string,
  operationIdInput: string,
  onCapture: (capture: z.infer<typeof itemViewResolutionCaptureSchema>) => void
) {
  const userId = userIdSchema.parse(userIdInput),
    operationId = entityIdSchema.parse(operationIdInput)
  if (context.transaction.db.name !== localDatabaseName(userId))
    throw new Error("Assignment capture belongs to another partition")
  queueLocalSettingsIncidentOverview(context, userId, (incidents, entries) => {
    try {
      const found = incidents.find(
        (value) =>
          value.kind === "preference" &&
          value.incident.entry.operation.operationId === operationId
      )
      if (
        found?.kind !== "preference" ||
        found.incident.entry.operation.command.type !== "item-view.set"
      )
        throw new Error("Assignment incident is no longer unresolved")
      const command = found.incident.entry.operation.command
      const item = context.transaction.objectStore("items").get(command.itemId)
      item.onsuccess = () => {
        try {
          const parent = planSchema.parse(item.result)
          const view = found.incident.local[0]?.record
          if (view && view.store !== "itemViews")
            throw new Error("Assignment current view uses another domain")
          const tagId = view?.record.primaryTagId
          const finish = (localTag: unknown) => {
            try {
              const capture = itemViewResolutionCaptureSchema.parse({
                userId,
                incident: found.incident,
                entries,
                parent,
                localTag,
              })
              const snapshot = captureItemViewResolutionSnapshot(capture)
              let remaining = snapshot.acknowledgedDependencies.length
              if (!remaining) onCapture(capture)
              for (const prerequisite of snapshot.acknowledgedDependencies) {
                const result = context.transaction
                  .objectStore("syncMetadata")
                  .get(
                    `operation-outcome:${prerequisite.operation.operationId}`
                  )
                result.onsuccess = () => {
                  try {
                    const outcome = decodeLocalRecurringOutcome(
                      result.result,
                      userId
                    )
                    if (
                      outcome.result.outcome.status !== "applied" ||
                      JSON.stringify(outcome.operation) !==
                        JSON.stringify(prerequisite.operation)
                    )
                      throw new Error(
                        "Assignment prerequisite has no matching durable ACK"
                      )
                    if (!--remaining) onCapture(capture)
                  } catch (error) {
                    context.fail(error)
                  }
                }
              }
            } catch (error) {
              context.fail(error)
            }
          }
          if (tagId) {
            const tag = context.transaction.objectStore("tags").get(tagId)
            tag.onsuccess = () => {
              try {
                finish(
                  tag.result === undefined ? null : tagSchema.parse(tag.result)
                )
              } catch (error) {
                context.fail(error)
              }
            }
          } else finish(null)
        } catch (error) {
          context.fail(error)
        }
      }
    } catch (error) {
      context.fail(error)
    }
  })
}
export function readLocalItemViewResolutionSnapshot(
  database: IDBDatabase,
  userId: string,
  operationId: string
) {
  return runLocalTransaction<ItemViewResolutionSnapshot>(
    database,
    itemViewResolutionStoreNames,
    "readonly",
    (context) => {
      queueLocalItemViewResolutionCapture(
        context,
        userId,
        operationId,
        (capture) =>
          context.setResult(captureItemViewResolutionSnapshot(capture))
      )
    }
  )
}
