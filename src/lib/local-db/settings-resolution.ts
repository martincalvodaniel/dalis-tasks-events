"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import { queueLocalSettingsIncidentOverview } from "@/lib/local-db/sync-incidents"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import {
  planSettingsIncidentResolution,
  validateSettingsResolutionRecord,
} from "@/lib/sync/settings-resolution"
import { outboxEntrySchema, outboxSequenceSchema } from "@/schemas/local-sync"
import { userIdSchema } from "@/schemas/primitives"
import { settingsResolutionRequestSchema } from "@/schemas/settings-resolution"
import { userSettingsEntityKey } from "@/schemas/user-settings-key"
import type { SettingsResolutionRecord } from "@/types/settings-resolution"

export function resolveLocalSettingsIncident(
  database: IDBDatabase,
  userIdInput: string,
  input: unknown
): Promise<{
  status: "applied" | "replayed"
  record: SettingsResolutionRecord
}> {
  const userId = userIdSchema.parse(userIdInput),
    request = settingsResolutionRequestSchema.parse(input)
  if (request.userId !== userId || database.name !== localDatabaseName(userId))
    return Promise.reject(
      new Error("Settings decision belongs to another partition")
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
        replay = metadata.get(`settings-resolution:${request.resolutionId}`)
      replay.onsuccess = () => {
        try {
          if (replay.result !== undefined) {
            const record = validateSettingsResolutionRecord(
              replay.result,
              userId
            )
            if (
              JSON.stringify(
                planSettingsIncidentResolution(request, record.expected)
              ) !== JSON.stringify(record)
            )
              throw new Error(
                "Settings decision identity was reused with different evidence"
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
                  value.kind === "preference" &&
                  value.incident.entry.operation.operationId ===
                    request.expected.entry.operation.operationId
              )
              if (current?.kind !== "preference")
                throw new Error("Settings incident is no longer unresolved")
              const record = planSettingsIncidentResolution(
                  request,
                  current.incident
                ),
                ids = new Set(record.supersededOperationIds),
                byId = new Map(
                  entries.map((entry) => [entry.operation.operationId, entry])
                )
              if (evidence.result.length > 10000)
                throw new Error(
                  "Settings resolution metadata exceeds its complete record limit"
                )
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
                throw new Error("Settings decision identity is already in use")
              for (const entry of entries) {
                if (!isUnresolvedOutboxEntry(entry)) continue
                if (
                  !ids.has(entry.operation.operationId) &&
                  entry.dependencies.some((id) => ids.has(id))
                )
                  throw new Error(
                    "Settings decision has an unreviewed dependent intention"
                  )
                if (
                  ids.has(entry.operation.operationId) &&
                  entry.dependencies.some(
                    (id) =>
                      !ids.has(id) && byId.get(id)?.state !== "acknowledged"
                  )
                )
                  throw new Error(
                    "Settings decision has an unresolved external dependency"
                  )
              }
              const counter = outboxSequenceSchema.parse(sequence.result)
              if (entries.some((entry) => entry.sequence > counter.value))
                throw new Error(
                  "Settings resolution sequence is behind its durable queue"
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
              context.transaction.objectStore("settings").put(record.local)
              if (record.replacement) {
                const next = outboxSequenceSchema.parse({
                  key: "outbox-sequence",
                  value: counter.value + 1,
                })
                outbox.add(
                  outboxEntrySchema.parse({
                    userId,
                    entityKey: userSettingsEntityKey(userId),
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
