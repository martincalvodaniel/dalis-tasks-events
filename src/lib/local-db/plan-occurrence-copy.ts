"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import { planOccurrenceCohortStoreNames } from "@/lib/local-db/plan-occurrence-cohort-capture"
import { queueLocalSettingsIncidentOverview } from "@/lib/local-db/sync-incidents"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { decodeRemoteRecurringShadow } from "@/lib/sync/local-plan-occurrence-sync"
import {
  planOccurrenceCopy,
  validatePlanOccurrenceCopyRecord,
} from "@/lib/sync/plan-occurrence-copy"
import { localResolutionCapacitySchema } from "@/schemas/local-resolution-capacity"
import { outboxEntrySchema, outboxSequenceSchema } from "@/schemas/local-sync"
import { planOccurrenceCopyRequestSchema } from "@/schemas/plan-occurrence-copy"
import { userIdSchema } from "@/schemas/primitives"
import type { PlanOccurrenceCopyRecord } from "@/types/plan-occurrence-copy"

function metadataUsesIdentity(
  value: unknown,
  identities: ReadonlySet<string>
): boolean {
  if (!value || typeof value !== "object") return false
  for (const field of ["resolutionId", "operationId", "copyItemId", "importId"])
    if (field in value && identities.has(String(Reflect.get(value, field))))
      return true
  for (const field of [
    "operationIds",
    "dependentOperationIds",
    "supersededOperationIds",
  ])
    if (field in value) {
      const ids: unknown = Reflect.get(value, field)
      if (Array.isArray(ids) && ids.some((id) => identities.has(String(id))))
        return true
    }
  for (const field of [
    "operation",
    "replacement",
    "dependentReplacements",
    "replacements",
  ])
    if (field in value) {
      const nested: unknown = Reflect.get(value, field)
      if (
        Array.isArray(nested)
          ? nested.some((record) => metadataUsesIdentity(record, identities))
          : metadataUsesIdentity(nested, identities)
      )
        return true
    }
  return false
}

export function resolveLocalPlanOccurrenceCopy(
  database: IDBDatabase,
  actorInput: string,
  input: unknown
): Promise<{
  status: "applied" | "replayed"
  record: PlanOccurrenceCopyRecord
}> {
  const actor = userIdSchema.parse(actorInput),
    request = planOccurrenceCopyRequestSchema.parse(input)
  if (actor !== request.userId || database.name !== localDatabaseName(actor))
    return Promise.reject(
      new Error("Appearance copy belongs to another partition")
    )
  return runLocalTransaction(
    database,
    planOccurrenceCohortStoreNames,
    "readwrite",
    (context) => {
      const metadata = context.transaction.objectStore("syncMetadata"),
        replay = metadata.get(
          `appearance-copy-resolution:${request.resolutionId}`
        )
      replay.onsuccess = () => {
        try {
          if (replay.result !== undefined) {
            const record = validatePlanOccurrenceCopyRecord(
              replay.result,
              actor
            )
            if (
              JSON.stringify(planOccurrenceCopy(request, record.expected)) !==
              JSON.stringify(record)
            )
              throw new Error(
                "Appearance copy identity was reused with different evidence"
              )
            context.setResult({ status: "replayed", record })
            return
          }
          const evidence = metadata.getAll(undefined, 10001),
            sequence = metadata.get("outbox-sequence"),
            items = context.transaction
              .objectStore("items")
              .getAll(undefined, 10001),
            shadows = context.transaction
              .objectStore("remoteShadows")
              .getAll(undefined, 10001)
          let remaining = 4
          let snapshot: Parameters<
            Parameters<typeof queueLocalSettingsIncidentOverview>[2]
          > | null = null
          const finish = () => {
            if (remaining || !snapshot) return
            try {
              const [overview, entries] = snapshot,
                current = overview.find(
                  (value) =>
                    value.kind === "plan-occurrence" &&
                    value.incident.entry.operation.operationId ===
                      request.expected.entry.operation.operationId
                )
              if (current?.kind !== "plan-occurrence")
                throw new Error(
                  "Appearance copy incident is no longer unresolved"
                )
              const record = planOccurrenceCopy(request, current.incident),
                identities = new Set([
                  request.resolutionId,
                  request.operationId,
                  request.copyItemId,
                ]),
                ids = new Set(record.supersededOperationIds)
              localResolutionCapacitySchema.parse({
                outboxCount: entries.length,
                metadataCount: evidence.result.length,
                replacementCount: 1,
              })
              if (items.result.length >= 10000)
                throw new Error(
                  "Appearance copy would exceed the complete item limit"
                )
              if (shadows.result.length > 10000)
                throw new Error(
                  "Appearance copy shadow catalog exceeds its complete record limit"
                )
              if (
                items.result.some((item: { id: string }) =>
                  identities.has(item.id)
                ) ||
                entries.some(
                  (entry) =>
                    identities.has(entry.operation.operationId) ||
                    ("itemId" in entry.operation.command &&
                      entry.operation.command.itemId === request.copyItemId)
                ) ||
                evidence.result.some((value: unknown) =>
                  metadataUsesIdentity(value, identities)
                ) ||
                shadows.result.some((raw: unknown) => {
                  const shadow = decodeRemoteRecurringShadow(raw, actor)
                  return [...identities].some(
                    (id) =>
                      shadow.entityKey === `item:${id}` ||
                      shadow.entityKey.startsWith(`plan-occurrence:${id}:`)
                  )
                })
              )
                throw new Error("Appearance copy identity is already in use")
              for (const entry of entries)
                if (
                  !ids.has(entry.operation.operationId) &&
                  entry.dependencies.some((id) => ids.has(id))
                )
                  throw new Error(
                    "Appearance copy has an unreviewed external dependent"
                  )
              const counter = outboxSequenceSchema.parse(sequence.result)
              if (entries.some((entry) => entry.sequence > counter.value))
                throw new Error(
                  "Appearance copy sequence is behind its durable queue"
                )
              const nextCounter = outboxSequenceSchema.parse({
                  key: "outbox-sequence",
                  value: counter.value + 1,
                }),
                replacement = outboxEntrySchema.parse({
                  userId: actor,
                  entityKey: `item:${record.copyItemId}`,
                  operation: record.replacement,
                  sequence: nextCounter.value,
                  dependencies: [],
                  state: "pending",
                  attempts: 0,
                  lease: null,
                  createdAt: record.createdAt,
                }),
                outbox = context.transaction.objectStore("outbox")
              for (const entry of current.incident.intentions)
                outbox.put(
                  outboxEntrySchema.parse({
                    ...entry,
                    state: "superseded",
                    lease: null,
                  })
                )
              context.transaction.objectStore("occurrences").put(record.local)
              context.transaction.objectStore("items").add(record.copy)
              outbox.add(replacement)
              metadata.put(nextCounter)
              metadata.add(record)
              context.setResult({ status: "applied", record })
            } catch (error) {
              context.fail(error)
            }
          }
          for (const read of [evidence, sequence, items, shadows])
            read.onsuccess = () => {
              remaining--
              finish()
            }
          queueLocalSettingsIncidentOverview(
            context,
            actor,
            (overview, entries) => {
              snapshot = [overview, entries]
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
