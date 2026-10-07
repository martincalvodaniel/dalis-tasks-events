"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import { parseLocalRecord } from "@/lib/local-db/store-config"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { userIdSchema } from "@/schemas/primitives"
import type { CalendarItem, ItemOccurrence } from "@/types/calendar-item"
import type { UserSettings } from "@/types/preferences"

export interface LocalTaskSnapshot {
  items: CalendarItem[]
  occurrences: ItemOccurrence[]
  settings: UserSettings
}

export function readLocalTaskSnapshot(
  database: IDBDatabase,
  userId: string
): Promise<LocalTaskSnapshot> {
  const actor = userIdSchema.parse(userId)
  if (database.name !== localDatabaseName(actor))
    return Promise.reject(
      new Error("Task snapshot belongs to another account partition")
    )
  return runLocalTransaction(
    database,
    ["items", "occurrences", "settings"],
    "readonly",
    (context) => {
      const itemsRequest = context.transaction.objectStore("items").getAll()
      const occurrencesRequest = context.transaction
        .objectStore("occurrences")
        .getAll()
      const settingsRequest = context.transaction
        .objectStore("settings")
        .get(actor)
      let remaining = 3
      function finish() {
        if (--remaining) return
        try {
          if (settingsRequest.result === undefined)
            throw new Error("Local settings are unavailable")
          const settings = parseLocalRecord(
            "settings",
            settingsRequest.result,
            actor
          )
          if (settings.deletedAt)
            throw new Error("Local settings are unavailable")
          context.setResult({
            items: itemsRequest.result.map((value) =>
              parseLocalRecord("items", value, actor)
            ),
            occurrences: occurrencesRequest.result.map((value) =>
              parseLocalRecord("occurrences", value, actor)
            ),
            settings,
          })
        } catch (error) {
          context.fail(error)
        }
      }
      itemsRequest.onsuccess = finish
      occurrencesRequest.onsuccess = finish
      settingsRequest.onsuccess = finish
    }
  )
}
