"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { decodeRemoteRecurringShadow } from "@/lib/sync/local-plan-occurrence-sync"
import {
  planLocalRecurringChangesPage,
  validateLocalRecurringChangesPageInput,
} from "@/lib/sync/local-recurring-pull"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import {
  itemViewSchema,
  tagSchema,
  taskPlacementSchema,
} from "@/schemas/preferences"
import { userIdSchema } from "@/schemas/primitives"
import type { PersonalSnapshot } from "@/types/personal-snapshot"

// Prepared generation-five port. The caller owns epoch checks around this transaction.
export function applyLocalRecurringChangesPage(
  database: IDBDatabase,
  userIdInput: unknown,
  receiptInput: unknown
): Promise<"applied" | "ignored"> {
  const userId = userIdSchema.parse(userIdInput)
  if (database.name !== localDatabaseName(userId))
    return Promise.reject(
      new Error("Recurring pull database belongs to another partition")
    )
  const receipt = validateLocalRecurringChangesPageInput(receiptInput, userId)
  const stores = [
    "items",
    "occurrences",
    "tags",
    "itemViews",
    "taskPlacements",
    "outbox",
    "remoteShadows",
    "syncMetadata",
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
      cursor: transaction.objectStore("syncMetadata").get("pull-cursor"),
    }
    let remaining = Object.keys(requests).length
    const finish = () => {
      if (--remaining) return
      try {
        for (const [name, request] of Object.entries(requests))
          if (name !== "cursor" && request.result.length > 10000)
            throw new Error("Recurring pull snapshot exceeds its record limit")
        const local: PersonalSnapshot = [
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
        const plan = planLocalRecurringChangesPage({
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
    for (const request of Object.values(requests)) request.onsuccess = finish
  })
}
