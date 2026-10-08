import { userIdSchema } from "@/schemas/primitives"
import { remoteOperationReceiptV2Schema } from "@/schemas/remote-operation-receipt-v2"
import { remoteOperationReceiptSchema } from "@/schemas/remote-sync"
import type { RemoteOperationReceiptV2 } from "@/types/remote-operation-receipt-v2"

// Parsing history does not verify its digest, remote commit, or current access.
export function validateRemoteOperationReceiptV2(
  input: unknown,
  expectedUserIdInput: unknown
): RemoteOperationReceiptV2 {
  const expectedUserId = userIdSchema.parse(expectedUserIdInput)
  const receipt = remoteOperationReceiptV2Schema.parse(input)
  if (receipt.actorUserId !== expectedUserId)
    throw new Error("Remote operation receipt belongs to another account")
  return receipt
}

export function decodeRemoteOperationReceipt(
  input: unknown,
  expectedUserIdInput: unknown
): RemoteOperationReceiptV2 {
  const versioned = remoteOperationReceiptV2Schema.safeParse(input)
  if (versioned.success)
    return validateRemoteOperationReceiptV2(versioned.data, expectedUserIdInput)
  const legacy = remoteOperationReceiptSchema.parse(input)
  return validateRemoteOperationReceiptV2(
    {
      ...legacy,
      version: 2,
      result: { kind: "item", outcome: legacy.result },
    },
    expectedUserIdInput
  )
}
