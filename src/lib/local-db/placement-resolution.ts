"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import {
  placementResolutionStoreNames,
  queueLocalPlacementResolutionCapture,
} from "@/lib/local-db/placement-resolution-capture"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import {
  planPlacementIncidentResolution,
  validatePlacementResolutionRecord,
} from "@/lib/sync/placement-decision"
import { capturePlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import { localResolutionCapacitySchema } from "@/schemas/local-resolution-capacity"
import {
  outboxEntrySchema,
  outboxSequenceSchema,
  preferenceTailSchema,
} from "@/schemas/local-sync"
import { placementResolutionRequestSchema } from "@/schemas/placement-resolution"
import { userIdSchema } from "@/schemas/primitives"
import type { PlacementResolutionRecord } from "@/types/placement-resolution"

export function resolveLocalPlacementIncident(
  database: IDBDatabase,
  userIdInput: string,
  input: unknown
): Promise<{
  status: "applied" | "replayed"
  record: PlacementResolutionRecord
}> {
  const userId = userIdSchema.parse(userIdInput),
    request = placementResolutionRequestSchema.parse(input)
  if (request.userId !== userId || database.name !== localDatabaseName(userId))
    return Promise.reject(
      new Error("Placement decision belongs to another partition")
    )
  return runLocalTransaction(
    database,
    placementResolutionStoreNames,
    "readwrite",
    (context) => {
      const metadata = context.transaction.objectStore("syncMetadata"),
        replay = metadata.get(`placement-resolution:${request.resolutionId}`)
      replay.onsuccess = () => {
        try {
          if (replay.result !== undefined) {
            const record = validatePlacementResolutionRecord(
              replay.result,
              userId
            )
            if (
              JSON.stringify(
                planPlacementIncidentResolution(request, record.expected)
              ) !== JSON.stringify(record)
            )
              throw new Error(
                "Placement decision identity was reused with different evidence"
              )
            context.setResult({ status: "replayed", record })
            return
          }
          const sequence = metadata.get("outbox-sequence"),
            evidence = metadata.getAll(undefined, 10001)
          let sequenceReady = false,
            evidenceReady = false
          let snapshot:
            | Parameters<
                Parameters<typeof queueLocalPlacementResolutionCapture>[3]
              >[0]
            | null = null
          const finish = () => {
            if (!sequenceReady || !evidenceReady || !snapshot) return
            try {
              const entries = snapshot.entries
              const current = capturePlacementResolutionSnapshot(snapshot)
              const record = planPlacementIncidentResolution(request, current),
                ids = new Set(record.supersededOperationIds),
                byId = new Map(
                  entries.map((entry) => [entry.operation.operationId, entry])
                )
              if (evidence.result.length > 10000)
                throw new Error(
                  "Placement resolution metadata exceeds its complete record limit"
                )
              const tail = evidence.result.find(
                (value) => value?.key === "preference-tail"
              )
              if (
                tail &&
                !byId.has(preferenceTailSchema.parse(tail).operationId)
              )
                throw new Error(
                  "Plan order preference tail is missing its intention"
                )
              localResolutionCapacitySchema.parse({
                outboxCount: entries.length,
                metadataCount:
                  evidence.result.length +
                  Number(Boolean(record.replacement && !tail)),
                replacementCount: record.replacement ? 1 : 0,
              })
              const identities = [
                request.resolutionId,
                ...(request.operationId ? [request.operationId] : []),
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
                throw new Error("Placement decision identity is already in use")
              for (const entry of entries) {
                if (!isUnresolvedOutboxEntry(entry)) continue
                if (
                  !ids.has(entry.operation.operationId) &&
                  entry.dependencies.some((id) => ids.has(id))
                )
                  throw new Error(
                    "Placement decision has an unreviewed dependent intention"
                  )
                if (
                  ids.has(entry.operation.operationId) &&
                  entry.dependencies.some(
                    (id) =>
                      !ids.has(id) && byId.get(id)?.state !== "acknowledged"
                  )
                )
                  throw new Error(
                    "Placement decision has an unresolved external dependency"
                  )
              }
              const counter = outboxSequenceSchema.parse(sequence.result)
              if (entries.some((entry) => entry.sequence > counter.value))
                throw new Error(
                  "Placement resolution sequence is behind its durable queue"
                )
              const next = outboxSequenceSchema.parse({
                key: "outbox-sequence",
                value: counter.value + Number(Boolean(record.replacement)),
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
              for (const placement of record.placements)
                context.transaction.objectStore("taskPlacements").put(placement)
              if (record.replacement) {
                outbox.add(
                  outboxEntrySchema.parse({
                    userId,
                    entityKey: record.expected.incident.entry.entityKey,
                    operation: record.replacement,
                    sequence: next.value,
                    dependencies: [],
                    state: "pending",
                    attempts: 0,
                    createdAt: record.createdAt,
                    lease: null,
                  })
                )
                metadata.put(next)
                metadata.put(
                  preferenceTailSchema.parse({
                    key: "preference-tail",
                    operationId: record.replacement.operationId,
                  })
                )
              }
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
          queueLocalPlacementResolutionCapture(
            context,
            userId,
            request.expected.incident.entry.operation.operationId,
            (capture) => {
              snapshot = capture
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
