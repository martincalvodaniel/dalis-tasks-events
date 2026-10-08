import "server-only"

import type { ClientSession, Document } from "mongodb"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { decodeRemoteOperationReceipt } from "@/lib/sync/remote-operation-receipt-v2"
import { entityIdSchema, userIdSchema } from "@/schemas/primitives"
import type { RemoteOperationReceiptV2 } from "@/types/remote-operation-receipt-v2"

export async function readRemoteOperationReceipt(
  actorInput: unknown,
  operationIdInput: unknown,
  session?: ClientSession
): Promise<RemoteOperationReceiptV2 | null> {
  const actor = userIdSchema.parse(actorInput)
  const operationId = entityIdSchema.parse(operationIdInput)
  const receipts = await getCollection<Document>(
    COLLECTION_NAMES.syncOperations
  )
  const stored = await receipts.findOne(
    { actorUserId: actor, operationId },
    { session }
  )
  if (!stored) return null
  const { _id, ...value } = stored
  const receipt = decodeRemoteOperationReceipt(value, actor)
  if (receipt.operationId !== operationId)
    throw new Error("Stored receipt identity does not match its request")
  return receipt
}
