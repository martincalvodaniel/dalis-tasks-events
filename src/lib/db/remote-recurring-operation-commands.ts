import "server-only"

import { executeRemoteRecurringPlanOperation } from "@/lib/db/remote-item-commands"
import { executeRemoteRecurringItemViewOperation } from "@/lib/db/remote-item-view-commands"
import { executeRemotePlanOccurrenceOperation } from "@/lib/db/remote-plan-occurrence-commands"
import { executeRemoteRecurringTagOperation } from "@/lib/db/remote-tag-commands"
import { executeRemoteRecurringTaskPlacementOperation } from "@/lib/db/remote-task-placement-commands"
import { validateRemoteRecurringOperationResult } from "@/lib/sync/remote-recurring-push"
import { userIdSchema } from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"
import type { RemoteRecurringOperationResult } from "@/types/remote-recurring-sync"

// Prepared dispatcher only. An authenticated service must supply the actor; active generation four stays separate.
export async function executeRemoteRecurringOperation(
  actorInput: unknown,
  operationInput: unknown
): Promise<RemoteRecurringOperationResult> {
  const actor = userIdSchema.parse(actorInput)
  const operation = syncOperationSchema.parse(operationInput)
  let result: RemoteRecurringOperationResult
  switch (operation.command.type) {
    case "plan.set-occurrence-status":
    case "plan.set-occurrence-checklist-entry":
    case "plan.update-occurrence":
    case "plan.cancel-occurrence":
      result = await executeRemotePlanOccurrenceOperation(actor, operation)
      break
    case "item-view.set":
      result = await executeRemoteRecurringItemViewOperation(actor, operation)
      break
    case "task.move":
      result = await executeRemoteRecurringTaskPlacementOperation(
        actor,
        operation
      )
      break
    case "tag.save":
    case "tag.delete":
    case "tag.move":
    case "settings.update":
      result = await executeRemoteRecurringTagOperation(actor, operation)
      break
    default:
      result = {
        kind: "item",
        outcome: await executeRemoteRecurringPlanOperation(actor, operation),
      }
  }
  // An incompatible historical receipt must never be relabeled into an ACK.
  return validateRemoteRecurringOperationResult(result, actor, operation)
}

// The future authenticated bundle selects this port only after settings index readiness.
export async function executeRemoteSettingsOperation(
  actorInput: unknown,
  operationInput: unknown
): Promise<RemoteRecurringOperationResult> {
  const actor = userIdSchema.parse(actorInput),
    operation = syncOperationSchema.parse(operationInput)
  if (operation.command.type !== "settings.update")
    return executeRemoteRecurringOperation(actor, operation)
  const { executeRemoteUserSettingsOperation } = await import(
    "@/lib/db/remote-user-settings-commands"
  )
  return validateRemoteRecurringOperationResult(
    await executeRemoteUserSettingsOperation(actor, operation),
    actor,
    operation
  )
}
