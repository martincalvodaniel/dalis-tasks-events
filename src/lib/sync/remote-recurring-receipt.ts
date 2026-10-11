import { decodeRemoteOperationReceipt } from "@/lib/sync/remote-operation-receipt-v2"
import { userIdSchema } from "@/schemas/primitives"
import { remoteRecurringOperationReceiptSchema } from "@/schemas/remote-plan-occurrence-result"
import type { RemoteRecurringOperationReceipt } from "@/types/remote-recurring-sync"

// Parsing history neither confirms a commit nor grants current series access.
export function decodeRemoteRecurringOperationReceipt(
  input: unknown,
  expectedActorInput: unknown
): RemoteRecurringOperationReceipt {
  const actor = userIdSchema.parse(expectedActorInput)
  const prepared = remoteRecurringOperationReceiptSchema.safeParse(input)
  const receipt = prepared.success
    ? prepared.data
    : decodeRemoteOperationReceipt(input, actor)
  if (receipt.actorUserId !== actor)
    throw new Error("Remote recurring receipt belongs to another account")
  return receipt
}
