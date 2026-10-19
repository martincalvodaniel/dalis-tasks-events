"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import {
  type LocalTransactionContext,
  runLocalTransaction,
} from "@/lib/local-db/transaction"
import { capturePlanOccurrenceCohortComparison } from "@/lib/sync/plan-occurrence-cohort-comparison"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { entityIdSchema, userIdSchema } from "@/schemas/primitives"
import type { PlanOccurrenceCohortComparison } from "@/types/plan-occurrence-cohort-comparison"

export const planOccurrenceCohortStoreNames = [
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

export function queueLocalPlanOccurrenceCohortCapture(
  context: Pick<LocalTransactionContext<unknown>, "transaction" | "fail">,
  actorInput: string,
  operationIdInput: string,
  onCapture: (
    comparison: PlanOccurrenceCohortComparison,
    metadata: unknown[]
  ) => void
) {
  const actor = userIdSchema.parse(actorInput),
    operationId = entityIdSchema.parse(operationIdInput)
  if (context.transaction.db.name !== localDatabaseName(actor))
    throw new Error("Appearance cohort capture belongs to another partition")
  const outbox = context.transaction
    .objectStore("outbox")
    .index("bySequence")
    .getAll(undefined, 10001)
  const occurrences = context.transaction
    .objectStore("occurrences")
    .getAll(undefined, 10001)
  const shadows = context.transaction
    .objectStore("remoteShadows")
    .getAll(undefined, 10001)
  const metadata = context.transaction
    .objectStore("syncMetadata")
    .getAll(undefined, 10001)
  let remaining = 4
  const finish = () => {
    if (--remaining) return
    try {
      if (
        [outbox, occurrences, shadows, metadata].some(
          (request) => request.result.length > 10000
        )
      )
        throw new Error(
          "Appearance cohort capture exceeds its complete record limit"
        )
      const entries = outbox.result.map((value: unknown) =>
        outboxEntrySchema.parse(value)
      )
      const root = entries.find(
        (entry) => entry.operation.operationId === operationId
      )
      if (
        !root ||
        !("occurrenceId" in root.operation.command) ||
        !("itemId" in root.operation.command)
      )
        throw new Error(
          "Appearance cohort requires an existing appearance intention"
        )
      const seriesId = root.operation.command.itemId
      const parent = context.transaction.objectStore("items").get(seriesId)
      parent.onsuccess = () => {
        try {
          const comparison = capturePlanOccurrenceCohortComparison({
            userId: actor,
            operationId,
            series: parent.result,
            entries,
            occurrences: occurrences.result.filter(
              (value: { seriesId?: unknown; id?: unknown } | null) =>
                value?.seriesId === seriesId ||
                (typeof value?.id === "string" &&
                  value.id.startsWith(`${seriesId}:`))
            ),
            shadows: shadows.result,
            outcomes: metadata.result.filter(
              (value: unknown) =>
                value &&
                typeof value === "object" &&
                ("result" in value ||
                  ("key" in value &&
                    typeof value.key === "string" &&
                    value.key.startsWith("operation-outcome:")))
            ),
          })
          onCapture(comparison, metadata.result)
        } catch (error) {
          context.fail(error)
        }
      }
    } catch (error) {
      context.fail(error)
    }
  }
  for (const request of [outbox, occurrences, shadows, metadata])
    request.onsuccess = finish
}

export function readLocalPlanOccurrenceCohortComparison(
  database: IDBDatabase,
  actor: string,
  operationId: string
): Promise<PlanOccurrenceCohortComparison> {
  return runLocalTransaction(
    database,
    planOccurrenceCohortStoreNames,
    "readonly",
    (context) => {
      queueLocalPlanOccurrenceCohortCapture(
        context,
        actor,
        operationId,
        (comparison) => context.setResult(comparison)
      )
    }
  )
}
