"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import {
  planOccurrenceCohortStoreNames,
  queueLocalPlanOccurrenceCohortCapture,
} from "@/lib/local-db/plan-occurrence-cohort-capture"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import {
  planOccurrenceCohortResolution,
  validatePlanOccurrenceCohortResolutionRecord,
} from "@/lib/sync/plan-occurrence-cohort-resolution"
import { localResolutionCapacitySchema } from "@/schemas/local-resolution-capacity"
import { outboxEntrySchema, outboxSequenceSchema } from "@/schemas/local-sync"
import { planOccurrenceCohortResolutionRequestSchema } from "@/schemas/plan-occurrence-cohort-resolution"
import { userIdSchema } from "@/schemas/primitives"
import type { PlanOccurrenceCohortResolutionRecord } from "@/types/plan-occurrence-cohort-resolution"

export function resolveLocalPlanOccurrenceCohort(
  database: IDBDatabase,
  actorInput: string,
  input: unknown
): Promise<{
  status: "applied" | "replayed"
  record: PlanOccurrenceCohortResolutionRecord
}> {
  const actor = userIdSchema.parse(actorInput),
    request = planOccurrenceCohortResolutionRequestSchema.parse(input)
  if (request.userId !== actor || database.name !== localDatabaseName(actor))
    return Promise.reject(
      new Error("Appearance cohort decision belongs to another partition")
    )
  return runLocalTransaction(
    database,
    planOccurrenceCohortStoreNames,
    "readwrite",
    (context) => {
      const metadata = context.transaction.objectStore("syncMetadata")
      const replay = metadata.get(
        `appearance-cohort-resolution:${request.resolutionId}`
      )
      replay.onsuccess = () => {
        try {
          if (replay.result !== undefined) {
            const record = validatePlanOccurrenceCohortResolutionRecord(
              replay.result,
              actor
            )
            if (
              JSON.stringify(
                planOccurrenceCohortResolution(request, record.expected)
              ) !== JSON.stringify(record)
            )
              throw new Error(
                "Appearance cohort decision identity was reused with different evidence"
              )
            context.setResult({ status: "replayed", record })
            return
          }
          queueLocalPlanOccurrenceCohortCapture(
            context,
            actor,
            request.expected.source.operationId,
            (comparison, evidence) => {
              try {
                const record = planOccurrenceCohortResolution(
                  request,
                  comparison
                )
                const entries = comparison.source.entries
                const replacements = record.replacements
                localResolutionCapacitySchema.parse({
                  outboxCount: entries.length,
                  metadataCount: evidence.length,
                  replacementCount: replacements.length,
                })
                const identities = new Set([
                  request.resolutionId,
                  ...request.operationIds,
                ])
                if (
                  evidence.some(
                    (value) =>
                      value &&
                      typeof value === "object" &&
                      (("resolutionId" in value &&
                        identities.has(String(value.resolutionId))) ||
                        ("operation" in value &&
                          value.operation &&
                          typeof value.operation === "object" &&
                          "operationId" in value.operation &&
                          identities.has(String(value.operation.operationId))))
                  )
                )
                  throw new Error(
                    "Appearance cohort decision identity is already in use in metadata"
                  )
                const counter = outboxSequenceSchema.parse(
                  evidence.find(
                    (value) =>
                      value &&
                      typeof value === "object" &&
                      "key" in value &&
                      value.key === "outbox-sequence"
                  )
                )
                if (entries.some((entry) => entry.sequence > counter.value))
                  throw new Error(
                    "Appearance cohort counter is behind its durable queue"
                  )
                const nextCounter = outboxSequenceSchema.parse({
                  key: "outbox-sequence",
                  value: counter.value + replacements.length,
                })
                const ids = new Set(record.supersededOperationIds)
                const outbox = context.transaction.objectStore("outbox")
                for (const entry of entries)
                  if (ids.has(entry.operation.operationId))
                    outbox.put(
                      outboxEntrySchema.parse({
                        ...entry,
                        state: "superseded",
                        lease: null,
                      })
                    )
                for (const slot of record.locals)
                  context.transaction
                    .objectStore("occurrences")
                    .put(slot.record)
                for (const [index, replacement] of replacements.entries())
                  outbox.add(
                    outboxEntrySchema.parse({
                      userId: actor,
                      entityKey: `item:${comparison.source.series.id}`,
                      operation: replacement.operation,
                      dependencies: replacement.dependencies,
                      sequence: counter.value + index + 1,
                      state: "pending",
                      attempts: 0,
                      lease: null,
                      createdAt: record.createdAt,
                    })
                  )
                if (replacements.length) metadata.put(nextCounter)
                metadata.add(record)
                context.setResult({ status: "applied", record })
              } catch (error) {
                context.fail(error)
              }
            }
          )
        } catch (error) {
          context.fail(error)
        }
      }
    }
  )
}
