import "server-only"

import { syncOperationVersion } from "@/config/sync-protocol"
import { OperationIdentityReuseError } from "@/lib/sync/operation-identity-reuse"
import {
  remoteOperationKind,
  validateRemotePushResultV2,
} from "@/lib/sync/remote-push-v2"
import { userIdSchema } from "@/schemas/primitives"
import {
  remotePushInputV2Schema,
  remotePushProtocolEnvelopeV2Schema,
  remotePushResultV2Schema,
} from "@/schemas/remote-push-v2"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"
import type { RemotePushResultV2 } from "@/types/remote-push-v2"
import type { SyncOperation } from "@/types/sync"

interface PushDependenciesV2 {
  readActor(): Promise<string | null>
  execute(
    actor: string,
    operation: SyncOperation
  ): Promise<RemoteOperationResultV2>
}

// Preparatory service: no public action until the client supports mixed ACK and pull.
export async function pushSyncBatchV2(
  input: unknown,
  dependencies: PushDependenciesV2
): Promise<RemotePushResultV2> {
  const actor = await dependencies.readActor()
  if (!actor) return { transportVersion: 2, status: "unauthorized" }
  const userId = userIdSchema.parse(actor)
  const envelope = remotePushProtocolEnvelopeV2Schema.safeParse(input)
  if (!envelope.success) return { transportVersion: 2, status: "invalid_batch" }
  if (envelope.data.expectedUserId !== userId)
    return { transportVersion: 2, status: "account_changed" }
  if (
    envelope.data.transportVersion !== 2 ||
    envelope.data.operations.some(
      (operation) => operation.protocolVersion !== syncOperationVersion
    )
  )
    return { transportVersion: 2, status: "update_required" }
  const batch = remotePushInputV2Schema.safeParse(input)
  if (!batch.success) return { transportVersion: 2, status: "invalid_batch" }
  const results: RemoteOperationResultV2[] = []
  for (const [index, operation] of batch.data.operations.entries()) {
    try {
      let result: RemoteOperationResultV2
      try {
        result = await dependencies.execute(userId, operation)
      } catch (error) {
        if (!(error instanceof OperationIdentityReuseError)) throw error
        result = {
          kind: remoteOperationKind(operation.command),
          outcome: {
            operationId: operation.operationId,
            status: "identity_reuse",
          },
        }
      }
      const next = batch.data.operations[index + 1]
      const candidate = validateRemotePushResultV2(
        next
          ? {
              transportVersion: 2,
              status: "retry_later",
              results: [...results, result],
              failedOperationId: next.operationId,
            }
          : {
              transportVersion: 2,
              status: "complete",
              results: [...results, result],
            },
        userId,
        batch.data
      )
      if (!("results" in candidate))
        throw new Error("Expected validated mixed results")
      results.push(candidate.results[index])
    } catch {
      // This operation may already be committed. Preserve its intention for durable replay.
      return remotePushResultV2Schema.parse({
        transportVersion: 2,
        status: "retry_later",
        results,
        failedOperationId: operation.operationId,
      })
    }
  }
  return remotePushResultV2Schema.parse({
    transportVersion: 2,
    status: "complete",
    results,
  })
}
