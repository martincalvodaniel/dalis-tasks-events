"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import {
  itemViewResolutionStoreNames,
  queueLocalItemViewResolutionCapture,
} from "@/lib/local-db/item-view-resolution-capture"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import {
  captureItemViewResolutionSnapshot,
  planItemViewIncidentResolution,
  validateItemViewResolutionRecord,
} from "@/lib/sync/item-view-resolution"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import { itemViewResolutionRequestSchema } from "@/schemas/item-view-resolution"
import { localResolutionCapacitySchema } from "@/schemas/local-resolution-capacity"
import { outboxEntrySchema, outboxSequenceSchema } from "@/schemas/local-sync"
import { userIdSchema } from "@/schemas/primitives"
import type { ItemViewResolutionRecord } from "@/types/item-view-resolution"

export function resolveLocalItemViewIncident(
  database: IDBDatabase,
  userIdInput: string,
  input: unknown
): Promise<{
  status: "applied" | "replayed"
  record: ItemViewResolutionRecord
}> {
  const userId = userIdSchema.parse(userIdInput),
    request = itemViewResolutionRequestSchema.parse(input)
  if (request.userId !== userId || database.name !== localDatabaseName(userId))
    return Promise.reject(
      new Error("ItemView decision belongs to another partition")
    )
  return runLocalTransaction(
    database,
    itemViewResolutionStoreNames,
    "readwrite",
    (context) => {
      const metadata = context.transaction.objectStore("syncMetadata"),
        replay = metadata.get(`item-view-resolution:${request.resolutionId}`)
      replay.onsuccess = () => {
        try {
          if (replay.result !== undefined) {
            const record = validateItemViewResolutionRecord(
              replay.result,
              userId
            )
            if (
              JSON.stringify(
                planItemViewIncidentResolution(request, record.expected)
              ) !== JSON.stringify(record)
            )
              throw new Error(
                "ItemView decision identity was reused with different evidence"
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
                Parameters<typeof queueLocalItemViewResolutionCapture>[3]
              >[0]
            | null = null
          const finish = () => {
            if (!sequenceReady || !evidenceReady || !snapshot) return
            try {
              const entries = snapshot.entries
              const current = captureItemViewResolutionSnapshot(snapshot)
              const record = planItemViewIncidentResolution(request, current),
                ids = new Set(record.supersededOperationIds),
                byId = new Map(
                  entries.map((entry) => [entry.operation.operationId, entry])
                )
              if (evidence.result.length > 10000)
                throw new Error(
                  "ItemView resolution metadata exceeds its complete record limit"
                )
              localResolutionCapacitySchema.parse({
                outboxCount: entries.length,
                metadataCount: evidence.result.length,
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
                throw new Error("ItemView decision identity is already in use")
              for (const entry of entries) {
                if (!isUnresolvedOutboxEntry(entry)) continue
                if (
                  !ids.has(entry.operation.operationId) &&
                  entry.dependencies.some((id) => ids.has(id))
                )
                  throw new Error(
                    "ItemView decision has an unreviewed dependent intention"
                  )
                if (
                  ids.has(entry.operation.operationId) &&
                  entry.dependencies.some(
                    (id) =>
                      !ids.has(id) && byId.get(id)?.state !== "acknowledged"
                  )
                )
                  throw new Error(
                    "ItemView decision has an unresolved external dependency"
                  )
              }
              const counter = outboxSequenceSchema.parse(sequence.result)
              if (entries.some((entry) => entry.sequence > counter.value))
                throw new Error(
                  "ItemView resolution sequence is behind its durable queue"
                )
              const outbox = context.transaction.objectStore("outbox")
              for (const id of ids)
                outbox.put(
                  outboxEntrySchema.parse({
                    ...byId.get(id),
                    state: "superseded",
                    lease: null,
                  })
                )
              context.transaction.objectStore("itemViews").put(record.local)
              if (record.replacement) {
                const next = outboxSequenceSchema.parse({
                  key: "outbox-sequence",
                  value: counter.value + 1,
                })
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
          queueLocalItemViewResolutionCapture(
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
