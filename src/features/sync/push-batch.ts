import "server-only"

import { syncProtocolVersion } from "@/config/sync-protocol"
import { OperationIdentityReuseError } from "@/lib/db/remote-item-commands"
import { userIdSchema } from "@/schemas/primitives"
import {
  remotePushInputSchema,
  remotePushProtocolEnvelopeSchema,
  remotePushResultSchema,
} from "@/schemas/remote-sync"
import type {
  RemoteOperationResult,
  RemotePushResult,
} from "@/types/remote-sync"
import type { SyncOperation } from "@/types/sync"

interface PushDependencies {
  readActor(): Promise<string | null>
  execute(
    actor: string,
    operation: SyncOperation
  ): Promise<RemoteOperationResult>
}

export async function pushSyncBatch(
  input: unknown,
  dependencies: PushDependencies
): Promise<RemotePushResult> {
  const actor = await dependencies.readActor()
  if (!actor) return { status: "unauthorized" }
  const userId = userIdSchema.parse(actor)
  const envelope = remotePushProtocolEnvelopeSchema.safeParse(input)
  if (!envelope.success) return { status: "invalid_batch" }
  if (envelope.data.expectedUserId !== userId)
    return { status: "account_changed" }
  if (
    envelope.data.operations.some(
      (operation) => operation.protocolVersion !== syncProtocolVersion
    )
  )
    return { status: "update_required" }
  const batch = remotePushInputSchema.safeParse(input)
  if (!batch.success) return { status: "invalid_batch" }
  if (batch.data.expectedUserId !== userId) return { status: "account_changed" }
  const results: RemoteOperationResult[] = []
  for (const operation of batch.data.operations) {
    try {
      results.push(await dependencies.execute(userId, operation))
    } catch (error) {
      if (error instanceof OperationIdentityReuseError) {
        results.push({
          status: "identity_reuse",
          operationId: operation.operationId,
        })
        continue
      }
      return remotePushResultSchema.parse({
        status: "retry_later",
        results,
        failedOperationId: operation.operationId,
      })
    }
  }
  return remotePushResultSchema.parse({ status: "complete", results })
}
