import { validateRemotePlanOccurrenceOperationResult } from "@/lib/sync/local-plan-occurrence-sync"
import {
  remoteOperationKind,
  validateRemotePushResultV2,
} from "@/lib/sync/remote-push-v2"
import { userIdSchema } from "@/schemas/primitives"
import { remoteRecurringOperationResultSchema } from "@/schemas/remote-plan-occurrence-result"
import { remotePushInputV2Schema } from "@/schemas/remote-push-v2"
import { remoteRecurringPushResultSchema } from "@/schemas/remote-recurring-push"
import { syncOperationSchema } from "@/schemas/sync"
import type { RemoteRecurringPushResult } from "@/types/remote-recurring-push"
import type { RemoteRecurringOperationResult } from "@/types/remote-recurring-sync"
import type { SyncCommand } from "@/types/sync"

export function remoteRecurringOperationKind(
  command: SyncCommand
): RemoteRecurringOperationResult["kind"] {
  switch (command.type) {
    case "plan.set-occurrence-status":
    case "plan.set-occurrence-checklist-entry":
    case "plan.update-occurrence":
    case "plan.cancel-occurrence":
      return "plan-occurrence"
    default:
      return remoteOperationKind(command)
  }
}

// Correspondence only: authorization, remote execution and durable ACK belong to their own boundaries.
export function validateRemoteRecurringOperationResult(
  input: unknown,
  actorInput: unknown,
  operationInput: unknown
): RemoteRecurringOperationResult {
  const actor = userIdSchema.parse(actorInput)
  const operation = syncOperationSchema.parse(operationInput)
  const result = remoteRecurringOperationResultSchema.parse(input)
  if (
    result.kind !== remoteRecurringOperationKind(operation.command) ||
    result.outcome.operationId !== operation.operationId
  )
    throw new Error(
      "Recurring result does not match its operation family or identity"
    )
  if (result.kind === "plan-occurrence")
    return validateRemotePlanOccurrenceOperationResult(result, actor, operation)
  validateRemotePushResultV2(
    { transportVersion: 2, status: "complete", results: [result] },
    actor,
    { transportVersion: 2, expectedUserId: actor, operations: [operation] }
  )
  return result
}

export function validateRemoteRecurringPushResult(
  input: unknown,
  actorInput: unknown,
  requestInput: unknown
): RemoteRecurringPushResult {
  const actor = userIdSchema.parse(actorInput)
  const request = remotePushInputV2Schema.parse(requestInput)
  if (request.expectedUserId !== actor)
    throw new Error("Recurring push request belongs to another account")
  const response = remoteRecurringPushResultSchema.parse(input)
  if (!("results" in response)) return response
  if (
    response.status === "complete" &&
    response.results.length !== request.operations.length
  )
    throw new Error("Recurring push response does not complete its request")
  if (
    response.status === "retry_later" &&
    (response.results.length >= request.operations.length ||
      response.failedOperationId !==
        request.operations[response.results.length].operationId)
  )
    throw new Error("Recurring push retry does not match its request prefix")
  for (const [index, result] of response.results.entries())
    validateRemoteRecurringOperationResult(
      result,
      actor,
      request.operations[index]
    )
  return response
}
