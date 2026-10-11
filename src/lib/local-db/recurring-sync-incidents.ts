"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { projectPlanOccurrenceSyncIncidents } from "@/lib/sync/recurring-incident-snapshot"
import { userIdSchema } from "@/schemas/primitives"
import type { PlanOccurrenceSyncIncidentSnapshot } from "@/types/recurring-sync-incident"

// Prepared reader. Account authorization and epoch checks remain with the future caller.
export function readLocalPlanOccurrenceSyncIncidents(
  database: IDBDatabase,
  userIdInput: unknown
): Promise<PlanOccurrenceSyncIncidentSnapshot[]> {
  const userId = userIdSchema.parse(userIdInput)
  if (database.name !== localDatabaseName(userId))
    return Promise.reject(
      new Error("Recurring incident database belongs to another partition")
    )
  return runLocalTransaction(
    database,
    ["items", "occurrences", "outbox", "remoteShadows", "syncMetadata"],
    "readonly",
    (context) => {
      const transaction = context.transaction
      const requests = {
        items: transaction.objectStore("items").getAll(undefined, 10001),
        occurrences: transaction
          .objectStore("occurrences")
          .getAll(undefined, 10001),
        entries: transaction.objectStore("outbox").getAll(undefined, 10001),
        shadows: transaction
          .objectStore("remoteShadows")
          .getAll(undefined, 10001),
        metadata: transaction
          .objectStore("syncMetadata")
          .getAll(undefined, 10001),
      }
      let remaining = Object.keys(requests).length
      const finish = () => {
        if (--remaining) return
        try {
          for (const request of Object.values(requests))
            if (request.result.length > 10000)
              throw new Error(
                "Recurring incident snapshot exceeds its record limit"
              )
          const outcomes = requests.metadata.result.filter(
            (value: unknown) =>
              value &&
              typeof value === "object" &&
              ("result" in value ||
                ("key" in value &&
                  typeof value.key === "string" &&
                  value.key.startsWith("operation-outcome:")))
          )
          context.setResult(
            projectPlanOccurrenceSyncIncidents({
              userId,
              items: requests.items.result,
              occurrences: requests.occurrences.result,
              entries: requests.entries.result,
              shadows: requests.shadows.result,
              outcomes,
            })
          )
        } catch (error) {
          context.fail(error)
        }
      }
      for (const request of Object.values(requests)) request.onsuccess = finish
    }
  )
}
