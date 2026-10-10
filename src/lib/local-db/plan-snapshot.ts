"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import { parseLocalRecord } from "@/lib/local-db/store-config"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { userIdSchema } from "@/schemas/primitives"
import type { CalendarItem, ItemOccurrence } from "@/types/calendar-item"
import type { ItemView, Tag, UserSettings } from "@/types/preferences"

export interface LocalPlanSnapshot {
  items: CalendarItem[]
  occurrences: ItemOccurrence[]
  tags: Tag[]
  views: ItemView[]
  settings: UserSettings
}

export function readLocalPlanSnapshot(
  database: IDBDatabase,
  userId: string
): Promise<LocalPlanSnapshot> {
  const actor = userIdSchema.parse(userId)
  if (database.name !== localDatabaseName(actor))
    return Promise.reject(
      new Error("Plan snapshot belongs to another account partition")
    )
  return runLocalTransaction(
    database,
    ["items", "occurrences", "tags", "itemViews", "settings"],
    "readonly",
    (context) => {
      const items = context.transaction
        .objectStore("items")
        .getAll(undefined, 10001)
      const occurrences = context.transaction
        .objectStore("occurrences")
        .getAll(undefined, 10001)
      const tags = context.transaction
        .objectStore("tags")
        .getAll(undefined, 10001)
      const views = context.transaction
        .objectStore("itemViews")
        .getAll(undefined, 10001)
      const settings = context.transaction.objectStore("settings").get(actor)
      let remaining = 5
      function finish() {
        if (--remaining) return
        try {
          if (
            [items, occurrences, tags, views].some(
              (request) => request.result.length > 10000
            )
          )
            throw new Error("Plan snapshot exceeds its complete catalog limit")
          if (settings.result === undefined)
            throw new Error("Local settings are unavailable")
          const configuration = parseLocalRecord(
            "settings",
            settings.result,
            actor
          )
          if (configuration.deletedAt)
            throw new Error("Local settings are unavailable")
          context.setResult({
            items: items.result.map((record) =>
              parseLocalRecord("items", record, actor)
            ),
            occurrences: occurrences.result.map((record) =>
              parseLocalRecord("occurrences", record, actor)
            ),
            tags: tags.result.map((record) =>
              parseLocalRecord("tags", record, actor)
            ),
            views: views.result.map((record) =>
              parseLocalRecord("itemViews", record, actor)
            ),
            settings: configuration,
          })
        } catch (error) {
          context.fail(error)
        }
      }
      items.onsuccess = finish
      occurrences.onsuccess = finish
      tags.onsuccess = finish
      views.onsuccess = finish
      settings.onsuccess = finish
    }
  )
}
