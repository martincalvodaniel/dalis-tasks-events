import "server-only"

import type { ClientSession, Document } from "mongodb"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { syncOperationFingerprint } from "@/lib/sync/operation-fingerprint"
import { OperationIdentityReuseError } from "@/lib/sync/operation-identity-reuse"
import { decodeRemoteOperationReceipt } from "@/lib/sync/remote-operation-receipt-v2"
import { entityIdSchema, userIdSchema } from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"
import type { RemoteOperationReceiptV2 } from "@/types/remote-operation-receipt-v2"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"

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

// The caller must supply an authenticated actor and apply its authorization policy.
export async function readRemoteOperationReplay(
  actorInput: unknown,
  operationInput: unknown,
  session?: ClientSession
): Promise<RemoteOperationResultV2 | null> {
  const actor = userIdSchema.parse(actorInput)
  const operation = syncOperationSchema.parse(operationInput)
  const fingerprint = syncOperationFingerprint(operation)
  const receipt = await readRemoteOperationReceipt(
    actor,
    operation.operationId,
    session
  )
  if (!receipt) return null
  if (receipt.fingerprint !== fingerprint)
    throw new OperationIdentityReuseError()
  return receipt.result
}
