"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import { queueLocalSettingsIncidentOverview } from "@/lib/local-db/sync-incidents"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import {
  planOccurrenceIncidentResolution,
  validatePlanOccurrenceResolutionRecord,
} from "@/lib/sync/plan-occurrence-resolution"
import { outboxEntrySchema, outboxSequenceSchema } from "@/schemas/local-sync"
import {
  planOccurrenceResolutionCapacitySchema,
  planOccurrenceResolutionRequestSchema,
} from "@/schemas/plan-occurrence-resolution"
import { userIdSchema } from "@/schemas/primitives"
import type { PlanOccurrenceResolutionRecord } from "@/types/plan-occurrence-resolution"

export function resolveLocalPlanOccurrenceIncident(
  database: IDBDatabase,
  userIdInput: string,
  input: unknown
): Promise<{
  status: "applied" | "replayed"
  record: PlanOccurrenceResolutionRecord
}> {
  const userId = userIdSchema.parse(userIdInput),
    request = planOccurrenceResolutionRequestSchema.parse(input)
  if (request.userId !== userId || database.name !== localDatabaseName(userId))
    return Promise.reject(
      new Error("Appearance decision belongs to another partition")
    )
  return runLocalTransaction(
    database,
    [
      "settings",
      "items",
      "occurrences",
      "tags",
      "itemViews",
      "taskPlacements",
      "remoteShadows",
      "outbox",
      "syncMetadata",
    ],
    "readwrite",
    (context) => {
      const metadata = context.transaction.objectStore("syncMetadata"),
        replay = metadata.get(`appearance-resolution:${request.resolutionId}`)
      replay.onsuccess = () => {
        try {
          if (replay.result !== undefined) {
            const record = validatePlanOccurrenceResolutionRecord(
              replay.result,
              userId
            )
            if (
              JSON.stringify(
                planOccurrenceIncidentResolution(request, record.expected)
              ) !== JSON.stringify(record)
            )
              throw new Error(
                "Appearance decision identity was reused with different evidence"
              )
            context.setResult({ status: "replayed", record })
            return
          }
          const sequence = metadata.get("outbox-sequence"),
            evidence = metadata.getAll(undefined, 10001)
          let sequenceReady = false,
            evidenceReady = false
          let snapshot: Parameters<
            Parameters<typeof queueLocalSettingsIncidentOverview>[2]
          > | null = null
          const finish = () => {
            if (!sequenceReady || !evidenceReady || !snapshot) return
            try {
              const [overview, entries] = snapshot
              const current = overview.find(
                (value) =>
                  value.kind === "plan-occurrence" &&
                  value.incident.entry.operation.operationId ===
                    request.expected.entry.operation.operationId
              )
              if (current?.kind !== "plan-occurrence")
                throw new Error("Appearance incident is no longer unresolved")
              const record = planOccurrenceIncidentResolution(
                  request,
                  current.incident
                ),
                ids = new Set(record.supersededOperationIds),
                byId = new Map(
                  entries.map((entry) => [entry.operation.operationId, entry])
                )
              if (evidence.result.length > 10000)
                throw new Error(
                  "Appearance resolution metadata exceeds its complete record limit"
                )
              const replacements = record.replacement
                ? [record.replacement, ...(record.dependentReplacements ?? [])]
                : []
              planOccurrenceResolutionCapacitySchema.parse({
                outboxCount: entries.length,
                metadataCount: evidence.result.length,
                replacementCount: replacements.length,
              })
              const identities = [
                request.resolutionId,
                ...replacements.map((operation) => operation.operationId),
              ]
              if (
                identities.some((id) => byId.has(id)) ||
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
                  "Appearance decision identity is already in use"
                )
              for (const entry of entries) {
                if (!isUnresolvedOutboxEntry(entry)) continue
                if (
                  !ids.has(entry.operation.operationId) &&
                  entry.dependencies.some((id) => ids.has(id))
                )
                  throw new Error(
                    "Appearance decision has an unreviewed dependent intention"
                  )
                if (
                  ids.has(entry.operation.operationId) &&
                  entry.dependencies.some(
                    (id) =>
                      !ids.has(id) && byId.get(id)?.state !== "acknowledged"
                  )
                )
                  throw new Error(
                    "Appearance decision has an unresolved external dependency"
                  )
              }
              const counter = outboxSequenceSchema.parse(sequence.result)
              if (entries.some((entry) => entry.sequence > counter.value))
                throw new Error(
                  "Appearance resolution sequence is behind its durable queue"
                )
              const nextCounter = outboxSequenceSchema.parse({
                key: "outbox-sequence",
                value: counter.value + replacements.length,
              })
              const outbox = context.transaction.objectStore("outbox")
              for (const id of ids)
                outbox.put(
                  outboxEntrySchema.parse({
                    ...byId.get(id),
                    state: "superseded",
                    lease: null,
                  })
                )
              context.transaction.objectStore("occurrences").put(record.local)
              for (const [index, operation] of replacements.entries())
                outbox.add(
                  outboxEntrySchema.parse({
                    userId,
                    entityKey: current.incident.entry.entityKey,
                    operation,
                    sequence: counter.value + index + 1,
                    dependencies: index
                      ? [replacements[index - 1].operationId]
                      : [],
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
          sequence.onsuccess = () => {
            sequenceReady = true
            finish()
          }
          evidence.onsuccess = () => {
            evidenceReady = true
            finish()
          }
          queueLocalSettingsIncidentOverview(
            context,
            userId,
            (incidents, entries) => {
              snapshot = [incidents, entries]
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
