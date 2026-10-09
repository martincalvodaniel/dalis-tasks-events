import "server-only"

import { executeRemoteOperationV2 } from "@/lib/db/remote-operation-commands"
import { executeRemoteTaskPlacementOperation } from "@/lib/db/remote-task-placement-commands"
import { validateRemoteOperationResultV2 } from "@/lib/sync/remote-operation-result-v2"
import { remoteOperationKind } from "@/lib/sync/remote-push-v2"
import { userIdSchema } from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"

// Generation-three negotiation adds placements without rewriting intentions or receipts.
// The actor must come from an authenticated service; active generation-two callers remain separate.
export async function executeRemoteOperationV3(
  actorInput: unknown,
  operationInput: unknown
): Promise<RemoteOperationResultV2> {
  const actor = userIdSchema.parse(actorInput)
  const operation = syncOperationSchema.parse(operationInput)
  const result = validateRemoteOperationResultV2(
    operation.command.type === "task.move"
      ? await executeRemoteTaskPlacementOperation(actor, operation)
      : await executeRemoteOperationV2(actor, operation),
    actor
  )
  if (
    result.kind !== remoteOperationKind(operation.command) ||
    result.outcome.operationId !== operation.operationId
  )
    throw new Error("Stored outcome is incompatible with its operation family")
  return result
}
