import "server-only"

import { executeRemotePlanOperation } from "@/lib/db/remote-item-commands"
import { executeRemotePlanItemViewOperation } from "@/lib/db/remote-item-view-commands"
import { executeRemoteOperationV3 } from "@/lib/db/remote-operation-commands-v3"
import { executeRemotePlanTaskPlacementOperation } from "@/lib/db/remote-task-placement-commands"
import { validateRemoteOperationResultV2 } from "@/lib/sync/remote-operation-result-v2"
import { remoteOperationKind } from "@/lib/sync/remote-push-v2"
import { userIdSchema } from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"

// Generation four admits common plans while preserving intention and receipt formats.
// Personal preferences retain generation-three capabilities until separately extended.
export async function executeRemoteOperationV4(
  actorInput: unknown,
  operationInput: unknown
): Promise<RemoteOperationResultV2> {
  const actor = userIdSchema.parse(actorInput)
  const operation = syncOperationSchema.parse(operationInput)
  const kind = remoteOperationKind(operation.command)
  const result = validateRemoteOperationResultV2(
    kind === "item"
      ? {
          kind: "item",
          outcome: await executeRemotePlanOperation(actor, operation),
        }
      : operation.command.type === "item-view.set"
        ? await executeRemotePlanItemViewOperation(actor, operation)
        : operation.command.type === "task.move"
          ? await executeRemotePlanTaskPlacementOperation(actor, operation)
          : await executeRemoteOperationV3(actor, operation),
    actor
  )
  if (
    result.kind !== kind ||
    result.outcome.operationId !== operation.operationId
  )
    throw new Error("Stored outcome is incompatible with its operation family")
  return result
}
