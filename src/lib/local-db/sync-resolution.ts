"use client"

import { queueLocalSyncIncidents } from "@/lib/local-db/sync-incidents"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { planSyncIncidentResolution } from "@/lib/sync/incident-resolution"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import { outboxEntrySchema, outboxSequenceSchema } from "@/schemas/local-sync"
import {
  syncResolutionRecordSchema,
  syncResolutionRequestSchema,
} from "@/schemas/sync-resolution"
import type { SyncResolutionRecord } from "@/types/sync-resolution"

export interface LocalResolutionResult {
  status: "applied" | "replayed"
  record: SyncResolutionRecord
}

export function resolveLocalSyncIncident(
  database: IDBDatabase,
  userId: string,
  input: unknown
): Promise<LocalResolutionResult> {
  const request = syncResolutionRequestSchema.parse(input)
  if (request.userId !== userId)
    throw new Error("Resolution belongs to another account")
  if (request.choice === "copy_local")
    throw new Error("Copy recovery requires its dedicated local executor")
  const key = `incident-resolution:${request.resolutionId}`
  return runLocalTransaction(
    database,
    ["items", "outbox", "remoteShadows", "syncMetadata"],
    "readwrite",
    (context) => {
      const metadata = context.transaction.objectStore("syncMetadata")
      const replay = metadata.get(key)
      replay.onsuccess = () => {
        try {
          if (replay.result !== undefined) {
            const record = syncResolutionRecordSchema.parse(replay.result)
            const planned = planSyncIncidentResolution(request, record.expected)
            if (JSON.stringify(planned) !== JSON.stringify(record))
              throw new Error(
                "Resolution identity was reused with different evidence"
              )
            context.setResult({ status: "replayed", record })
            return
          }
          const sequence = metadata.get("outbox-sequence")
          const priorOutcome = request.operationId
            ? metadata.get(`operation-outcome:${request.operationId}`)
            : null
          let sequenceReady = false
          let outcomeReady = priorOutcome === null
          let snapshot: Parameters<
            Parameters<typeof queueLocalSyncIncidents>[2]
          > | null = null
          const finish = () => {
            if (!sequenceReady || !outcomeReady || !snapshot) return
            try {
              const [incidents, entries] = snapshot
              const incident = incidents.find(
                (candidate) =>
                  candidate.entry.operation.operationId ===
                  request.expected.entry.operation.operationId
              )
              if (!incident) throw new Error("Incident is no longer unresolved")
              const record = planSyncIncidentResolution(request, incident)
              const ids = new Set(record.supersededOperationIds)
              const byId = new Map(
                entries.map((entry) => [entry.operation.operationId, entry])
              )
              if (
                byId.has(request.resolutionId) ||
                (request.operationId &&
                  (byId.has(request.operationId) ||
                    priorOutcome?.result !== undefined))
              )
                throw new Error(
                  "Resolution operation identity was already used"
                )
              for (const entry of entries) {
                if (!isUnresolvedOutboxEntry(entry)) continue
                if (
                  !ids.has(entry.operation.operationId) &&
                  entry.dependencies.some((dependency) => ids.has(dependency))
                )
                  throw new Error(
                    "Resolution has related intentions outside its reviewed chain"
                  )
                if (
                  ids.has(entry.operation.operationId) &&
                  entry.dependencies.some(
                    (dependency) =>
                      !ids.has(dependency) &&
                      byId.get(dependency)?.state !== "acknowledged"
                  )
                )
                  throw new Error(
                    "Resolution chain has an unresolved external dependency"
                  )
              }
              const counter = outboxSequenceSchema.parse(sequence.result)
              if (entries.some((entry) => entry.sequence > counter.value))
                throw new Error(
                  "Resolution sequence is behind its durable queue"
                )
              const outbox = context.transaction.objectStore("outbox")
              for (const entry of incident.intentions)
                outbox.put(
                  outboxEntrySchema.parse({
                    ...entry,
                    state: "superseded",
                    lease: null,
                  })
                )
              context.transaction.objectStore("items").put(record.local)
              if (record.replacement) {
                const nextSequence = outboxSequenceSchema.parse({
                  key: "outbox-sequence",
                  value: counter.value + 1,
                })
                outbox.add(
                  outboxEntrySchema.parse({
                    userId,
                    entityKey: incident.entry.entityKey,
                    operation: record.replacement,
                    sequence: nextSequence.value,
                    dependencies: [],
                    state: "pending",
                    attempts: 0,
                    createdAt: record.createdAt,
                    lease: null,
                  })
                )
                metadata.put(nextSequence)
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
          if (priorOutcome)
            priorOutcome.onsuccess = () => {
              outcomeReady = true
              finish()
            }
          queueLocalSyncIncidents(context, userId, (incidents, entries) => {
            snapshot = [incidents, entries]
            finish()
          })
        } catch (error) {
          context.fail(error)
        }
      }
    }
  )
}
