import "server-only"

import { syncOperationVersion } from "@/config/sync-protocol"
import { OperationIdentityReuseError } from "@/lib/sync/operation-identity-reuse"
import {
  remoteRecurringOperationKind,
  validateRemoteRecurringPushResult,
} from "@/lib/sync/remote-recurring-push"
import { userIdSchema } from "@/schemas/primitives"
import {
  remotePushInputV2Schema,
  remotePushProtocolEnvelopeV2Schema,
} from "@/schemas/remote-push-v2"
import { remoteRecurringPushResultSchema } from "@/schemas/remote-recurring-push"
import type { RemoteRecurringPushResult } from "@/types/remote-recurring-push"
import type { RemoteRecurringOperationResult } from "@/types/remote-recurring-sync"
import type { SyncOperation } from "@/types/sync"

export interface RecurringPushDependencies {
  readActor(): Promise<string | null>
  execute(
    actor: string,
    operation: SyncOperation
  ): Promise<RemoteRecurringOperationResult>
}

// Prepared service only: negotiated clients, durable ACK and download consumers are separate prerequisites.
export async function pushRecurringSyncBatch(
  input: unknown,
  dependencies: RecurringPushDependencies
): Promise<RemoteRecurringPushResult> {
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
  const results: RemoteRecurringOperationResult[] = []
  for (const [index, operation] of batch.data.operations.entries()) {
    try {
      let result: RemoteRecurringOperationResult
      try {
        result = await dependencies.execute(userId, operation)
      } catch (error) {
        if (!(error instanceof OperationIdentityReuseError)) throw error
        const kind = remoteRecurringOperationKind(operation.command)
        const outcome = {
          operationId: operation.operationId,
          status: "identity_reuse" as const,
        }
        result =
          kind === "plan-occurrence"
            ? { kind, userId, outcome }
            : { kind, outcome }
      }
      const next = batch.data.operations[index + 1]
      const candidate = validateRemoteRecurringPushResult(
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
        throw new Error("Expected validated recurring results")
      results.push(candidate.results[index])
    } catch {
      // A commit may precede a lost response. Keep this intention for durable replay.
      return remoteRecurringPushResultSchema.parse({
        transportVersion: 2,
        status: "retry_later",
        results,
        failedOperationId: operation.operationId,
      })
    }
  }
  return remoteRecurringPushResultSchema.parse({
    transportVersion: 2,
    status: "complete",
    results,
  })
}
