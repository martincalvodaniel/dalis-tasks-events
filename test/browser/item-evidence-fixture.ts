import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { decodeLocalItemOutcome } from "@/lib/sync/local-item-outcome-v2"
import { decodeRemoteShadow } from "@/lib/sync/remote-shadow-v2"

async function accessItemEvidence(
  userId: string,
  itemId: string,
  operationId: string | undefined,
  version: boolean
): Promise<{ shadow: unknown; outcome: unknown }> {
  if (location.hostname !== "127.0.0.1" || !userId.startsWith("browser-test-"))
    throw new Error("Item evidence fixtures require an isolated test partition")
  const database = await openLocalDatabase(userId)
  try {
    if (database.name !== localDatabaseName(userId))
      throw new Error("Item evidence fixture partition is inconsistent")
    return await runLocalTransaction(
      database,
      ["remoteShadows", "syncMetadata"],
      version ? "readwrite" : "readonly",
      (context) => {
        const shadows = context.transaction.objectStore("remoteShadows")
        const metadata = context.transaction.objectStore("syncMetadata")
        const shadow = shadows.get(`item:${itemId}`)
        const outcome = operationId
          ? metadata.get(`operation-outcome:${operationId}`)
          : null
        let remaining = outcome ? 2 : 1
        const finish = () => {
          if (--remaining) return
          try {
            if (version && shadow.result !== undefined) {
              const record = decodeRemoteShadow(shadow.result, userId)
              if (record.kind !== "item")
                throw new Error("Fixture requires item shadow evidence")
              shadows.put(record)
            }
            if (version && outcome?.result !== undefined)
              metadata.put(decodeLocalItemOutcome(outcome.result, userId))
            context.setResult({
              shadow: shadow.result,
              outcome: outcome?.result,
            })
          } catch (error) {
            context.fail(error)
          }
        }
        shadow.onsuccess = finish
        if (outcome) outcome.onsuccess = finish
      }
    )
  } finally {
    database.close()
  }
}

export function versionStoredItemEvidence(
  userId: string,
  itemId: string,
  operationId?: string
) {
  return accessItemEvidence(userId, itemId, operationId, true)
}

export function readStoredItemEvidence(
  userId: string,
  itemId: string,
  operationId?: string
) {
  return accessItemEvidence(userId, itemId, operationId, false)
}
