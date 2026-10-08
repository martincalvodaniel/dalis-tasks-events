"use client"

import { runLocalTransaction } from "@/lib/local-db/transaction"
import { projectSyncIncidentSnapshot } from "@/lib/sync/incident-snapshot"
import { outboxEntrySchema } from "@/schemas/local-sync"
import type { SyncIncidentSnapshot } from "@/types/sync-incident"

export function readLocalSyncIncidents(
  database: IDBDatabase,
  userId: string
): Promise<SyncIncidentSnapshot[]> {
  return runLocalTransaction(
    database,
    ["items", "outbox", "remoteShadows", "syncMetadata"],
    "readonly",
    (context) => {
      const items = context.transaction.objectStore("items").getAll()
      const entries = context.transaction.objectStore("outbox").getAll()
      const shadows = context.transaction.objectStore("remoteShadows").getAll()
      const outcomes: unknown[] = []
      let remaining = 3
      const finish = () => {
        if (--remaining) return
        try {
          context.setResult(
            projectSyncIncidentSnapshot({
              userId,
              items: items.result,
              entries: entries.result,
              shadows: shadows.result,
              outcomes,
            })
          )
        } catch (error) {
          context.fail(error)
        }
      }
      items.onsuccess = finish
      shadows.onsuccess = finish
      entries.onsuccess = () => {
        try {
          for (const value of entries.result) {
            const entry = outboxEntrySchema.parse(value)
            if (entry.state !== "conflict" && entry.state !== "rejected")
              continue
            remaining++
            const request = context.transaction
              .objectStore("syncMetadata")
              .get(`operation-outcome:${entry.operation.operationId}`)
            request.onsuccess = () => {
              outcomes.push(request.result)
              finish()
            }
          }
          finish()
        } catch (error) {
          context.fail(error)
        }
      }
    }
  )
}
