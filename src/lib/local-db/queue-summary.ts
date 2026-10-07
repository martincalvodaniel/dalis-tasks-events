"use client"

import { runLocalTransaction } from "@/lib/local-db/transaction"
import {
  type SyncQueueSummary,
  summarizeSyncQueue,
} from "@/lib/sync/queue-summary"

export function readLocalSyncQueueSummary(
  database: IDBDatabase,
  userId: string
): Promise<SyncQueueSummary> {
  return runLocalTransaction(
    database,
    ["items", "outbox"],
    "readonly",
    (context) => {
      const items = context.transaction.objectStore("items").getAll()
      const entries = context.transaction.objectStore("outbox").getAll()
      let completed = 0
      const finish = () => {
        completed++
        if (completed !== 2) return
        try {
          context.setResult(
            summarizeSyncQueue({
              userId,
              items: items.result,
              entries: entries.result,
            })
          )
        } catch (error) {
          context.fail(error)
        }
      }
      items.onsuccess = finish
      entries.onsuccess = finish
    }
  )
}
