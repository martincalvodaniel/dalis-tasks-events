import "server-only"

import { executeRemoteItemOperation } from "@/lib/db/remote-item-commands"
import { executeRemoteItemViewOperation } from "@/lib/db/remote-item-view-commands"
import { executeRemoteTagOperation } from "@/lib/db/remote-tag-commands"
import { validateRemoteOperationResultV2 } from "@/lib/sync/remote-operation-result-v2"
import { remoteOperationKind } from "@/lib/sync/remote-push-v2"
import { userIdSchema } from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"

// The actor must come from an authenticated service. No product callers yet.
export async function executeRemoteOperationV2(
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
          outcome: await executeRemoteItemOperation(actor, operation),
        }
      : operation.command.type === "item-view.set"
        ? await executeRemoteItemViewOperation(actor, operation)
        : await executeRemoteTagOperation(actor, operation),
    actor
  )
  // Unsupported personal commands still check receipt identity in their transaction.
  // Never relabel an incompatible historical outcome to manufacture an ACK.
  if (
    result.kind !== kind ||
    result.outcome.operationId !== operation.operationId
  )
    throw new Error("Stored outcome is incompatible with its operation family")
  return result
}
