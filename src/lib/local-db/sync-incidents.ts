"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import {
  type LocalTransactionContext,
  runLocalTransaction,
} from "@/lib/local-db/transaction"
import {
  projectSyncIncidentOverview,
  projectSyncIncidentSnapshot,
} from "@/lib/sync/incident-snapshot"
import {
  projectRecurringSettingsSyncIncidentOverview,
  projectRecurringSyncIncidentOverview,
} from "@/lib/sync/recurring-incident-snapshot"
import { outboxEntrySchema } from "@/schemas/local-sync"
import type { OutboxEntry } from "@/types/local-sync"
import type { RecurringSyncIncidentOverview } from "@/types/recurring-sync-incident"
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
  return readIncidentOverview(database, userId, false) as Promise<
    SyncIncidentOverview[]
  >
}
export function readLocalRecurringSyncIncidentOverview(
  database: IDBDatabase,
  userId: string
): Promise<RecurringSyncIncidentOverview[]> {
  if (database.name !== localDatabaseName(userId))
    return Promise.reject(
      new Error("Recurring incident database belongs to another partition")
    )
  return readIncidentOverview(database, userId, true)
}
export function readLocalSettingsSyncIncidentOverview(
  database: IDBDatabase,
  userId: string
): Promise<RecurringSyncIncidentOverview[]> {
  if (database.name !== localDatabaseName(userId))
    return Promise.reject(
      new Error("Settings incident database belongs to another partition")
    )
  return readIncidentOverview(database, userId, true, true)
}

function readIncidentOverview(
  database: IDBDatabase,
  userId: string,
  recurring: boolean,
  allowSettings = false
): Promise<RecurringSyncIncidentOverview[]> {
  return runLocalTransaction(
    database,
    [
      "items",
      "tags",
      "itemViews",
      "taskPlacements",
      "outbox",
      "remoteShadows",
      "syncMetadata",
      ...(recurring ? (["occurrences"] as const) : []),
      ...(allowSettings ? ["settings"] : []),
    ],
    "readonly",
    (context) => {
      queueIncidentEvidence(
        context,
        userId,
        true,
        (snapshot) =>
          context.setResult(snapshot as RecurringSyncIncidentOverview[]),
        recurring,
        allowSettings
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
  ) => void,
  recurring = false,
  allowSettings = false
) {
  if (allowSettings && !recurring)
    throw new Error("Settings resolution requires the complete recurring scope")
  queueIncidentEvidence(
    context,
    userId,
    recurring,
    (incidents, entries) =>
      onSnapshot(
        recurring
          ? (incidents as RecurringSyncIncidentOverview[]).flatMap((value) =>
              value.kind === "item" ? [value.incident] : []
            )
          : (incidents as SyncIncidentSnapshot[]),
        entries
      ),
    recurring,
    allowSettings
  )
}

function queueIncidentEvidence(
  context: Pick<LocalTransactionContext<unknown>, "transaction" | "fail">,
  userId: string,
  overview: boolean,
  onSnapshot: (
    incidents: RecurringSyncIncidentOverview[] | SyncIncidentSnapshot[],
    entries: OutboxEntry[]
  ) => void,
  recurring = false,
  allowSettings = false
) {
  const read = (
    name:
      | "items"
      | "outbox"
      | "remoteShadows"
      | "syncMetadata"
      | "tags"
      | "itemViews"
      | "taskPlacements"
      | "occurrences"
      | "settings"
  ) =>
    context.transaction
      .objectStore(name)
      .getAll(undefined, recurring ? 10001 : undefined)
  const items = read("items")
  const entries = read("outbox")
  const shadows = read("remoteShadows")
  const metadata = read("syncMetadata")
  const tags = overview ? read("tags") : null
  const itemViews = overview ? read("itemViews") : null
  const taskPlacements = overview ? read("taskPlacements") : null
  const occurrences = recurring ? read("occurrences") : null
  const settings = allowSettings ? read("settings") : null
  let remaining = (recurring ? 8 : overview ? 7 : 4) + Number(allowSettings)
  const finish = () => {
    if (--remaining) return
    try {
      if (
        recurring &&
        [
          items,
          entries,
          shadows,
          metadata,
          tags,
          itemViews,
          taskPlacements,
          occurrences,
          settings,
        ].some((request) => request && request.result.length > 10000)
      )
        throw new Error("Recurring incident snapshot exceeds its record limit")
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
      const projectRecurring = allowSettings
        ? projectRecurringSettingsSyncIncidentOverview
        : projectRecurringSyncIncidentOverview
      const snapshot = recurring
        ? projectRecurring({
            ...input,
            tags: tags?.result,
            itemViews: itemViews?.result,
            taskPlacements: taskPlacements?.result,
            occurrences: occurrences?.result,
            ...(allowSettings ? { settings: settings?.result } : {}),
          })
        : overview
          ? projectSyncIncidentOverview({
              ...input,
              tags: tags?.result,
              itemViews: itemViews?.result,
              taskPlacements: taskPlacements?.result,
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
  for (const request of [
    items,
    entries,
    shadows,
    metadata,
    tags,
    itemViews,
    taskPlacements,
    occurrences,
    settings,
  ])
    if (request) request.onsuccess = finish
}
