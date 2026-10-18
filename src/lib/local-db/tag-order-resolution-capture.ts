"use client"

import type { z } from "zod"
import { localDatabaseName } from "@/lib/local-db/client"
import { queueLocalSettingsIncidentOverview } from "@/lib/local-db/sync-incidents"
import {
  type LocalTransactionContext,
  runLocalTransaction,
} from "@/lib/local-db/transaction"
import { decodeRemoteRecurringShadow } from "@/lib/sync/local-plan-occurrence-sync"
import { decodeLocalRecurringOutcome } from "@/lib/sync/local-recurring-outcome"
import { captureTagOrderResolutionSnapshot } from "@/lib/sync/tag-order-resolution"
import { entityIdSchema, userIdSchema } from "@/schemas/primitives"
import { tagOrderResolutionCaptureSchema } from "@/schemas/tag-order-resolution"
import type { TagOrderResolutionSnapshot } from "@/types/tag-order-resolution"

export const tagOrderResolutionStoreNames = [
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
export function queueLocalTagOrderResolutionCapture(
  context: Pick<LocalTransactionContext<unknown>, "transaction" | "fail">,
  userIdInput: string,
  operationIdInput: string,
  onCapture: (capture: z.infer<typeof tagOrderResolutionCaptureSchema>) => void
) {
  const userId = userIdSchema.parse(userIdInput),
    operationId = entityIdSchema.parse(operationIdInput)
  if (context.transaction.db.name !== localDatabaseName(userId))
    throw new Error("Category order capture belongs to another partition")
  queueLocalSettingsIncidentOverview(context, userId, (incidents, entries) => {
    try {
      const found = incidents.find(
        (value) =>
          value.kind === "preference" &&
          value.incident.entry.operation.operationId === operationId
      )
      if (
        found?.kind !== "preference" ||
        found.incident.entry.operation.command.type !== "tag.move"
      )
        throw new Error("Category order incident is no longer unresolved")
      const tags = context.transaction
          .objectStore("tags")
          .getAll(undefined, 10001),
        shadows = context.transaction
          .objectStore("remoteShadows")
          .getAll(undefined, 10001)
      let remaining = 2
      const finish = () => {
        if (--remaining) return
        try {
          if (tags.result.length > 10000 || shadows.result.length > 10000)
            throw new Error(
              "Category order catalog exceeds its complete record limit"
            )
          const observedTags = shadows.result.flatMap((raw: unknown) => {
            const shadow = decodeRemoteRecurringShadow(raw, userId)
            return shadow.kind === "preference" &&
              shadow.record.store === "tags"
              ? [shadow.record.record]
              : []
          })
          const capture = tagOrderResolutionCaptureSchema.parse({
              userId,
              incident: found.incident,
              entries,
              localTags: tags.result,
              observedTags,
            }),
            snapshot = captureTagOrderResolutionSnapshot(capture)
          let pending = snapshot.acknowledgedDependencies.length
          if (!pending) onCapture(capture)
          for (const prerequisite of snapshot.acknowledgedDependencies) {
            const request = context.transaction
              .objectStore("syncMetadata")
              .get(`operation-outcome:${prerequisite.operation.operationId}`)
            request.onsuccess = () => {
              try {
                const outcome = decodeLocalRecurringOutcome(
                  request.result,
                  userId
                )
                if (
                  outcome.result.outcome.status !== "applied" ||
                  JSON.stringify(outcome.operation) !==
                    JSON.stringify(prerequisite.operation)
                )
                  throw new Error(
                    "Category order prerequisite has no matching durable ACK"
                  )
                if (!--pending) onCapture(capture)
              } catch (error) {
                context.fail(error)
              }
            }
          }
        } catch (error) {
          context.fail(error)
        }
      }
      tags.onsuccess = finish
      shadows.onsuccess = finish
    } catch (error) {
      context.fail(error)
    }
  })
}
export function readLocalTagOrderResolutionSnapshot(
  database: IDBDatabase,
  userId: string,
  operationId: string
) {
  return runLocalTransaction<TagOrderResolutionSnapshot>(
    database,
    tagOrderResolutionStoreNames,
    "readonly",
    (context) => {
      queueLocalTagOrderResolutionCapture(
        context,
        userId,
        operationId,
        (capture) =>
          context.setResult(captureTagOrderResolutionSnapshot(capture))
      )
    }
  )
}
