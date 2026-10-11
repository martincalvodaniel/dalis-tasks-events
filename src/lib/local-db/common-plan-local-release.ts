"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import { notifyLocalOutboxChange } from "@/lib/local-db/sync-notifications"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import {
  type CommonPlanLocalReleaseState,
  commonPlanContentStores,
  commonPlanLocalReleaseSchema,
  commonPlanLocalResetSchema,
} from "@/schemas/common-plan-local-release"
import { timestampSchema, userIdSchema } from "@/schemas/primitives"

export function prepareLocalCommonPlanRelease(
  database: IDBDatabase,
  userIdInput: string,
  preparedAtInput: string
): Promise<CommonPlanLocalReleaseState> {
  const userId = userIdSchema.parse(userIdInput)
  const preparedAt = timestampSchema.parse(preparedAtInput)
  if (database.name !== localDatabaseName(userId))
    throw new Error("Local release belongs to another account partition")
  return runLocalTransaction(
    database,
    [...commonPlanContentStores],
    "readwrite",
    (context) => {
      const metadata = context.transaction.objectStore("syncMetadata")
      const marker = metadata.get("common-plan-release")
      marker.onsuccess = () => {
        try {
          if (marker.result !== undefined) {
            const current = commonPlanLocalReleaseSchema.parse(marker.result)
            if (current.userId !== userId)
              throw new Error("Local release belongs to another account")
            context.setResult({ status: "ready" })
            return
          }
          let remaining = commonPlanContentStores.length
          let recordCount = 0
          for (const name of commonPlanContentStores) {
            const count = context.transaction.objectStore(name).count()
            count.onsuccess = () => {
              try {
                recordCount += count.result
                if (--remaining) return
                if (recordCount)
                  context.setResult({ status: "reset_required", recordCount })
                else {
                  metadata.add(
                    commonPlanLocalReleaseSchema.parse({
                      key: "common-plan-release",
                      version: 4,
                      userId,
                      preparedAt,
                      operationId: null,
                    })
                  )
                  context.setResult({ status: "ready" })
                }
              } catch (error) {
                context.fail(error)
              }
            }
          }
        } catch (error) {
          context.fail(error)
        }
      }
    }
  )
}

// Only an explicit device confirmation may clear this partition's former content.
export async function resetLocalCommonPlanContent(
  database: IDBDatabase,
  userIdInput: string,
  input: unknown
): Promise<void> {
  const userId = userIdSchema.parse(userIdInput)
  const reset = commonPlanLocalResetSchema.parse(input)
  if (database.name !== localDatabaseName(userId))
    throw new Error("Local reset belongs to another account partition")
  const changed = await runLocalTransaction<boolean>(
    database,
    [...commonPlanContentStores],
    "readwrite",
    (context) => {
      const metadata = context.transaction.objectStore("syncMetadata")
      const marker = metadata.get("common-plan-release")
      marker.onsuccess = () => {
        try {
          if (marker.result !== undefined) {
            const current = commonPlanLocalReleaseSchema.parse(marker.result)
            if (current.userId !== userId)
              throw new Error("Local release belongs to another account")
            // A concurrent completed preparation must never erase newly created plans.
            context.setResult(false)
            return
          }
          for (const name of commonPlanContentStores)
            context.transaction.objectStore(name).clear()
          metadata.add(
            commonPlanLocalReleaseSchema.parse({
              key: "common-plan-release",
              version: 4,
              userId,
              ...reset,
            })
          )
          context.setResult(true)
        } catch (error) {
          context.fail(error)
        }
      }
    }
  )
  if (changed) notifyLocalOutboxChange(userId)
}

export function requireLocalCommonPlanRelease(
  database: IDBDatabase,
  userIdInput: string
): Promise<void> {
  const userId = userIdSchema.parse(userIdInput)
  if (database.name !== localDatabaseName(userId))
    throw new Error("Local release belongs to another account partition")
  return runLocalTransaction(
    database,
    ["syncMetadata"],
    "readonly",
    (context) => {
      const marker = context.transaction
        .objectStore("syncMetadata")
        .get("common-plan-release")
      marker.onsuccess = () => {
        try {
          const current = commonPlanLocalReleaseSchema.parse(marker.result)
          if (current.userId !== userId)
            throw new Error("Local release belongs to another account")
          context.setResult(undefined)
        } catch (error) {
          context.fail(error)
        }
      }
    }
  )
}
