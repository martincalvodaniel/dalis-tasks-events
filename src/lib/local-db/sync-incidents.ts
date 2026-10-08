"use client"

import {
  type LocalTransactionContext,
  runLocalTransaction,
} from "@/lib/local-db/transaction"
import {
  projectSyncIncidentOverview,
  projectSyncIncidentSnapshot,
} from "@/lib/sync/incident-snapshot"
import { outboxEntrySchema } from "@/schemas/local-sync"
import type { OutboxEntry } from "@/types/local-sync"
import type {
  SyncIncidentOverview,
  SyncIncidentSnapshot,
} from "@/types/sync-incident"

export function readLocalSyncIncidents(
  database: IDBDatabase,
  userId: string
): Promise<SyncIncidentSnapshot[]> {
  return runLocalTransaction(
    database,
    ["items", "outbox", "remoteShadows", "syncMetadata"],
    "readonly",
    (context) => {
      queueLocalSyncIncidents(context, userId, (snapshot) =>
        context.setResult(snapshot)
      )
    }
  )
}

export function readLocalSyncIncidentOverview(
  database: IDBDatabase,
  userId: string
): Promise<SyncIncidentOverview[]> {
  return runLocalTransaction(
    database,
    ["items", "tags", "itemViews", "outbox", "remoteShadows", "syncMetadata"],
    "readonly",
    (context) => {
      queueIncidentEvidence(context, userId, true, (snapshot) =>
        context.setResult(snapshot as SyncIncidentOverview[])
      )
    }
  )
}

export function queueLocalSyncIncidents(
  context: Pick<LocalTransactionContext<unknown>, "transaction" | "fail">,
  userId: string,
  onSnapshot: (
    incidents: SyncIncidentSnapshot[],
    entries: OutboxEntry[]
  ) => void
) {
  queueIncidentEvidence(context, userId, false, (incidents, entries) =>
    onSnapshot(incidents as SyncIncidentSnapshot[], entries)
  )
}

function queueIncidentEvidence(
  context: Pick<LocalTransactionContext<unknown>, "transaction" | "fail">,
  userId: string,
  overview: boolean,
  onSnapshot: (
    incidents: SyncIncidentOverview[] | SyncIncidentSnapshot[],
    entries: OutboxEntry[]
  ) => void
) {
  const items = context.transaction.objectStore("items").getAll()
  const entries = context.transaction.objectStore("outbox").getAll()
  const shadows = context.transaction.objectStore("remoteShadows").getAll()
  const metadata = context.transaction.objectStore("syncMetadata").getAll()
  const tags = overview
    ? context.transaction.objectStore("tags").getAll()
    : null
  const itemViews = overview
    ? context.transaction.objectStore("itemViews").getAll()
    : null
  let remaining = overview ? 6 : 4
  const finish = () => {
    if (--remaining) return
    try {
      const outcomes = metadata.result.filter((value: unknown) => {
        if (!value || typeof value !== "object") return false
        return (
          "result" in value ||
          ("key" in value &&
            typeof value.key === "string" &&
            value.key.startsWith("operation-outcome:"))
        )
      })
      const input = {
        userId,
        items: items.result,
        entries: entries.result,
        shadows: shadows.result,
        outcomes,
      }
      const snapshot = overview
        ? projectSyncIncidentOverview({
            ...input,
            tags: tags?.result,
            itemViews: itemViews?.result,
          })
        : projectSyncIncidentSnapshot(input)
      onSnapshot(
        snapshot,
        entries.result.map((value: unknown) => outboxEntrySchema.parse(value))
      )
    } catch (error) {
      context.fail(error)
    }
  }
  for (const request of [items, entries, shadows, metadata, tags, itemViews])
    if (request) request.onsuccess = finish
}
