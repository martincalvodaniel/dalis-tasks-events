"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { decodeRemoteRecurringShadow } from "@/lib/sync/local-plan-occurrence-sync"
import {
  planLocalRecurringChangesPage,
  planLocalSettingsChangesPage,
  validateLocalRecurringChangesPageInput,
  validateLocalSettingsChangesPageInput,
} from "@/lib/sync/local-recurring-pull"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import {
  itemViewSchema,
  tagSchema,
  taskPlacementSchema,
  userSettingsSchema,
} from "@/schemas/preferences"
import { userIdSchema } from "@/schemas/primitives"
import { userSettingsEntityKey } from "@/schemas/user-settings-key"
import type { PersonalSnapshot } from "@/types/personal-snapshot"

// Prepared generation-five port. The caller owns epoch checks around this transaction.
export function applyLocalRecurringChangesPage(
  database: IDBDatabase,
  userIdInput: unknown,
  receiptInput: unknown
): Promise<"applied" | "ignored"> {
  return applyRecurringChangesPage(database, userIdInput, receiptInput, false)
}

export function applyLocalSettingsChangesPage(
  database: IDBDatabase,
  userIdInput: unknown,
  receiptInput: unknown
): Promise<"applied" | "ignored"> {
  return applyRecurringChangesPage(database, userIdInput, receiptInput, true)
}

function applyRecurringChangesPage(
  database: IDBDatabase,
  userIdInput: unknown,
  receiptInput: unknown,
  allowSettings: boolean
): Promise<"applied" | "ignored"> {
  const userId = userIdSchema.parse(userIdInput)
  if (database.name !== localDatabaseName(userId))
    return Promise.reject(
      new Error("Recurring pull database belongs to another partition")
    )
  const validate = allowSettings
    ? validateLocalSettingsChangesPageInput
    : validateLocalRecurringChangesPageInput
  const receipt = validate(receiptInput, userId)
  const stores = [
    "items",
    "occurrences",
    "tags",
    "itemViews",
    "taskPlacements",
    "outbox",
    "remoteShadows",
    "syncMetadata",
    ...(allowSettings ? ["settings"] : []),
  ]
  return runLocalTransaction(database, stores, "readwrite", (context) => {
    const transaction = context.transaction
    const requests = {
      items: transaction.objectStore("items").getAll(undefined, 10001),
      occurrences: transaction
        .objectStore("occurrences")
        .getAll(undefined, 10001),
      tags: transaction.objectStore("tags").getAll(undefined, 10001),
      views: transaction.objectStore("itemViews").getAll(undefined, 10001),
      placements: transaction
        .objectStore("taskPlacements")
        .getAll(undefined, 10001),
      entries: transaction.objectStore("outbox").getAll(undefined, 10001),
      shadows: transaction
        .objectStore("remoteShadows")
        .getAll(undefined, 10001),
      settings: allowSettings
        ? transaction.objectStore("settings").getAll(undefined, 10001)
        : null,
      cursor: transaction.objectStore("syncMetadata").get("pull-cursor"),
    }
    let remaining = Object.values(requests).filter(Boolean).length
    const finish = () => {
      if (--remaining) return
      try {
        for (const [name, request] of Object.entries(requests))
          if (request && name !== "cursor" && request.result.length > 10000)
            throw new Error("Recurring pull snapshot exceeds its record limit")
        const local: PersonalSnapshot = [
          ...(requests.settings?.result ?? []).map((input: unknown) => {
            const record = userSettingsSchema.parse(input)
            if (record.userId !== userId)
              throw new Error("Pull settings belong to another account")
            return {
              entityKey: userSettingsEntityKey(userId),
              record: { store: "settings" as const, record },
            }
          }),
          ...requests.tags.result.map((input: unknown) => {
            const record = tagSchema.parse(input)
            return {
              entityKey: `tag:${record.id}`,
              record: { store: "tags" as const, record },
            }
          }),
          ...requests.views.result.map((input: unknown) => {
            const record = itemViewSchema.parse(input)
            return {
              entityKey: `item-view:${record.itemId}`,
              record: { store: "itemViews" as const, record },
            }
          }),
          ...requests.placements.result.map((input: unknown) => {
            const record = taskPlacementSchema.parse(input)
            return {
              entityKey: taskPlacementEntityKey(
                record.occurrenceId,
                record.scope,
                record.date
              ),
              record: { store: "taskPlacements" as const, record },
            }
          }),
        ]
        const project = allowSettings
          ? planLocalSettingsChangesPage
          : planLocalRecurringChangesPage
        const plan = project({
          userId,
          receipt,
          cursor: requests.cursor.result ?? {
            key: "pull-cursor",
            after: 0,
            through: null,
          },
          items: requests.items.result,
          occurrences: requests.occurrences.result,
          local,
          entries: requests.entries.result,
          shadows: requests.shadows.result.map((input: unknown) =>
            decodeRemoteRecurringShadow(input, userId)
          ),
        })
        if (plan.status === "ignored") {
          context.setResult("ignored")
          return
        }
        const putChanged = <RecordValue>(
          store: string,
          before: unknown[],
          after: RecordValue[],
          identity: (value: RecordValue) => string
        ) => {
          // The planner has already validated every stored and resulting record.
          const old = new Map(
            before.map((record) => [
              identity(record as RecordValue),
              JSON.stringify(record),
            ])
          )
          for (const record of after)
            if (old.get(identity(record)) !== JSON.stringify(record))
              transaction.objectStore(store).put(record)
        }
        putChanged(
          "items",
          requests.items.result,
          plan.items,
          (record) => record.id
        )
        putChanged(
          "occurrences",
          requests.occurrences.result,
          plan.occurrences,
          (record) => record.id
        )
        for (const [store, before] of [
          ["tags", requests.tags.result],
          ["itemViews", requests.views.result],
          ["taskPlacements", requests.placements.result],
          ...(allowSettings
            ? [["settings", requests.settings?.result ?? []] as const]
            : []),
        ] as const) {
          const after = plan.local.flatMap((entry) =>
            entry.record?.store === store ? [entry.record.record] : []
          )
          // Use the store's own key path, including composite placement identities.
          const keyPath = transaction.objectStore(store).keyPath
          const identity = (record: Record<string, unknown>) =>
            JSON.stringify(
              Array.isArray(keyPath)
                ? keyPath.map((key) => record[key])
                : record[keyPath as string]
            )
          putChanged(store, before, after, identity)
        }
        putChanged(
          "remoteShadows",
          requests.shadows.result,
          plan.shadows,
          (record) => record.entityKey
        )
        transaction.objectStore("syncMetadata").put(plan.cursor)
        context.setResult("applied")
      } catch (error) {
        context.fail(error)
      }
    }
    for (const request of Object.values(requests))
      if (request) request.onsuccess = finish
  })
}
