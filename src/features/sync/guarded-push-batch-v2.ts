import "server-only"

import { pushSyncBatchV2 } from "@/features/sync/push-batch-v2"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"
import type { RemotePushResultV2 } from "@/types/remote-push-v2"
import type { SyncOperation } from "@/types/sync"

export interface GuardedPushDependenciesV2 {
  readActor(): Promise<string | null>
  readReadiness(): Promise<{
    ready: boolean
    missing: string[]
    incompatible: string[]
  }>
  execute(
    actor: string,
    operation: SyncOperation
  ): Promise<RemoteOperationResultV2>
}

export async function pushGuardedSyncBatchV2(
  input: unknown,
  dependencies: GuardedPushDependenciesV2
): Promise<RemotePushResultV2> {
  let readinessChecked = false
  return pushSyncBatchV2(input, {
    readActor: async () => {
      try {
        return await dependencies.readActor()
      } catch {
        throw new Error("Sync authentication is temporarily unavailable")
      }
    },
    execute: async (actor, operation) => {
      if (!readinessChecked) {
        try {
          const readiness = await dependencies.readReadiness()
          if (
            readiness.ready !== true ||
            !Array.isArray(readiness.missing) ||
            !Array.isArray(readiness.incompatible) ||
            readiness.missing.length ||
            readiness.incompatible.length
          )
            throw new Error("Sync storage is not ready")
        } catch {
          throw new Error("Sync storage is temporarily unavailable")
        }
        // This check observes readiness once; it does not freeze index definitions.
        readinessChecked = true
      }
      return dependencies.execute(actor, operation)
    },
  })
}
