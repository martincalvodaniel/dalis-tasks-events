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
import { capturePlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import { placementResolutionCaptureSchema } from "@/schemas/placement-resolution"
import { entityIdSchema, userIdSchema } from "@/schemas/primitives"
import type { PlacementResolutionSnapshot } from "@/types/placement-resolution"
export const placementResolutionStoreNames = [
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
export function queueLocalPlacementResolutionCapture(
  context: Pick<LocalTransactionContext<unknown>, "transaction" | "fail">,
  userIdInput: string,
  operationIdInput: string,
  onCapture: (capture: z.infer<typeof placementResolutionCaptureSchema>) => void
) {
  const userId = userIdSchema.parse(userIdInput),
    operationId = entityIdSchema.parse(operationIdInput)
  if (context.transaction.db.name !== localDatabaseName(userId))
    throw new Error("Placement capture belongs to another partition")
  queueLocalSettingsIncidentOverview(context, userId, (incidents, entries) => {
    try {
      const found = incidents.find(
        (value) =>
          value.kind === "preference" &&
          value.incident.entry.operation.operationId === operationId
      )
      if (
        found?.kind !== "preference" ||
        found.incident.entry.operation.command.type !== "task.move"
      )
        throw new Error("Placement incident is no longer unresolved")
      const names = [
          "occurrences",
          "items",
          "tags",
          "itemViews",
          "taskPlacements",
          "remoteShadows",
        ] as const,
        reads = names.map((name) =>
          context.transaction.objectStore(name).getAll(undefined, 10001)
        )
      let remaining = reads.length
      const finish = () => {
        if (--remaining) return
        try {
          if (reads.some((request) => request.result.length > 10000))
            throw new Error(
              "Placement catalog exceeds its complete record limit"
            )
          const observed: {
            items: unknown[]
            tags: unknown[]
            views: unknown[]
            placements: unknown[]
            occurrences: unknown[]
          } = {
            items: [],
            tags: [],
            views: [],
            placements: [],
            occurrences: [],
          }
          for (const raw of reads[5].result) {
            const shadow = decodeRemoteRecurringShadow(raw, userId)
            if (shadow.kind === "plan-occurrence")
              observed.occurrences.push(shadow.record)
            else if (shadow.kind === "item") observed.items.push(shadow.record)
            else if (shadow.kind === "preference") {
              if (shadow.record.store === "tags")
                observed.tags.push(shadow.record.record)
              if (shadow.record.store === "itemViews")
                observed.views.push(shadow.record.record)
              if (shadow.record.store === "taskPlacements")
                observed.placements.push(shadow.record.record)
            }
          }
          const capture = placementResolutionCaptureSchema.parse({
              userId,
              incident: found.incident,
              entries,
              local: {
                occurrences: reads[0].result,
                items: reads[1].result,
                tags: reads[2].result,
                views: reads[3].result,
                placements: reads[4].result,
              },
              observed,
            }),
            snapshot = capturePlacementResolutionSnapshot(capture)
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
                    "Placement prerequisite has no matching durable ACK"
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
      for (const request of reads) request.onsuccess = finish
    } catch (error) {
      context.fail(error)
    }
  })
}
export function readLocalPlacementResolutionSnapshot(
  database: IDBDatabase,
  userId: string,
  operationId: string
) {
  return runLocalTransaction<PlacementResolutionSnapshot>(
    database,
    placementResolutionStoreNames,
    "readonly",
    (context) =>
      queueLocalPlacementResolutionCapture(
        context,
        userId,
        operationId,
        (capture) =>
          context.setResult(capturePlacementResolutionSnapshot(capture))
      )
  )
}
