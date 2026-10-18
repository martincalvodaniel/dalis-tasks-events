"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import {
  planCategoryResolutionStoreNames,
  queueLocalPlanCategoryResolutionCapture,
} from "@/lib/local-db/plan-category-resolution-capture"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import {
  planPlanCategoryIncidentResolution,
  validatePlanCategoryResolutionRecord,
} from "@/lib/sync/plan-category-resolution"
import { localResolutionCapacitySchema } from "@/schemas/local-resolution-capacity"
import { outboxEntrySchema, outboxSequenceSchema } from "@/schemas/local-sync"
import { planCategoryResolutionRequestSchema } from "@/schemas/plan-category-resolution"
import { userIdSchema } from "@/schemas/primitives"
import type {
  PlanCategoryResolutionCapture,
  PlanCategoryResolutionRecord,
} from "@/types/plan-category-resolution"

export function resolveLocalPlanCategoryIncident(
  database: IDBDatabase,
  actorInput: string,
  input: unknown
): Promise<{
  status: "applied" | "replayed"
  record: PlanCategoryResolutionRecord
}> {
  const actor = userIdSchema.parse(actorInput),
    request = planCategoryResolutionRequestSchema.parse(input)
  if (request.userId !== actor || database.name !== localDatabaseName(actor))
    return Promise.reject(
      new Error("Joint decision belongs to another partition")
    )
  return runLocalTransaction(
    database,
    planCategoryResolutionStoreNames,
    "readwrite",
    (context) => {
      const metadata = context.transaction.objectStore("syncMetadata")
      const replay = metadata.get(
        `plan-category-resolution:${request.resolutionId}`
      )
      replay.onsuccess = () => {
        try {
          if (replay.result !== undefined) {
            const record = validatePlanCategoryResolutionRecord(
              replay.result,
              actor
            )
            const original = {
              userId: record.userId,
              resolutionId: record.resolutionId,
              operationId: record.operationId,
              viewOperationId: record.viewOperationId,
              choice: record.choice,
              createdAt: record.createdAt,
              expected: record.expected,
            }
            if (JSON.stringify(original) !== JSON.stringify(request))
              throw new Error(
                "Joint decision identity was reused with different evidence"
              )
            context.setResult({ status: "replayed", record })
            return
          }
          const sequence = metadata.get("outbox-sequence"),
            evidence = metadata.getAll(undefined, 10001)
          let sequenceReady = false,
            evidenceReady = false
          let capture: PlanCategoryResolutionCapture | null = null
          const finish = () => {
            if (!sequenceReady || !evidenceReady || !capture) return
            try {
              const record = planPlanCategoryIncidentResolution(
                request,
                capture
              )
              const entries = capture.entries
              if (evidence.result.length > 10000)
                throw new Error(
                  "Joint metadata exceeds its complete record limit"
                )
              const replacements =
                record.replacement && record.viewReplacement
                  ? [record.replacement, record.viewReplacement]
                  : []
              localResolutionCapacitySchema.parse({
                outboxCount: entries.length,
                metadataCount: evidence.result.length,
                replacementCount: replacements.length,
              })
              const identities = [
                request.resolutionId,
                request.operationId,
                request.viewOperationId,
              ].filter((id) => id !== null)
              if (
                evidence.result.some(
                  (value) =>
                    value &&
                    typeof value === "object" &&
                    (("resolutionId" in value &&
                      identities.includes(value.resolutionId)) ||
                      ("result" in value &&
                        identities.includes(value.operation?.operationId)))
                )
              )
                throw new Error(
                  "Joint decision identity is already in use in metadata"
                )
              const counter = outboxSequenceSchema.parse(sequence.result)
              if (entries.some((entry) => entry.sequence > counter.value))
                throw new Error("Joint sequence is behind its durable queue")
              const next = outboxSequenceSchema.parse({
                key: "outbox-sequence",
                value: counter.value + replacements.length,
              })
              const originals = new Set(record.supersededOperationIds)
              const outbox = context.transaction.objectStore("outbox")
              for (const entry of entries)
                if (originals.has(entry.operation.operationId))
                  outbox.put(
                    outboxEntrySchema.parse({
                      ...entry,
                      state: "superseded",
                      lease: null,
                    })
                  )
              context.transaction.objectStore("items").put(record.local)
              context.transaction.objectStore("itemViews").put(record.view)
              for (let index = 0; index < replacements.length; index++)
                outbox.add(
                  outboxEntrySchema.parse({
                    userId: actor,
                    entityKey: index
                      ? `item-view:${record.local.id}`
                      : `item:${record.local.id}`,
                    operation: replacements[index],
                    sequence: counter.value + index + 1,
                    dependencies: index ? [replacements[0].operationId] : [],
                    state: "pending",
                    attempts: 0,
                    createdAt: record.createdAt,
                    lease: null,
                  })
                )
              if (replacements.length) metadata.put(next)
              metadata.add(record)
              context.setResult({ status: "applied", record })
            } catch (error) {
              context.fail(error)
            }
          }
          sequence.onsuccess = () => {
            sequenceReady = true
            finish()
          }
          evidence.onsuccess = () => {
            evidenceReady = true
            finish()
          }
          queueLocalPlanCategoryResolutionCapture(
            context,
            actor,
            request.expected.incident.entry.operation.operationId,
            (current) => {
              capture = current
              finish()
            }
          )
        } catch (error) {
          context.fail(error)
        }
      }
    }
  )
}
