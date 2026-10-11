import "server-only"

import type { ClientSession, Document } from "mongodb"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { syncOperationFingerprint } from "@/lib/sync/operation-fingerprint"
import { OperationIdentityReuseError } from "@/lib/sync/operation-identity-reuse"
import { decodeRemoteRecurringOperationReceipt } from "@/lib/sync/remote-recurring-receipt"
import { entityIdSchema, userIdSchema } from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"
import type { RemoteRecurringOperationReceipt } from "@/types/remote-recurring-sync"

// Prepared readers share the receipt namespace without widening active decoders.
export async function readRemoteRecurringOperationReceipt(
  actorInput: unknown,
  operationIdInput: unknown,
  session?: ClientSession
): Promise<RemoteRecurringOperationReceipt | null> {
  const actor = userIdSchema.parse(actorInput)
  const operationId = entityIdSchema.parse(operationIdInput)
  const stored = await (
    await getCollection<Document>(COLLECTION_NAMES.syncOperations)
  ).findOne({ actorUserId: actor, operationId }, { session })
  if (!stored) return null
  const { _id, ...value } = stored
  const receipt = decodeRemoteRecurringOperationReceipt(value, actor)
  if (receipt.operationId !== operationId)
    throw new Error(
      "Stored recurring receipt identity does not match its request"
    )
  return receipt
}

export async function readRemoteRecurringOperationReplay(
  actorInput: unknown,
  operationInput: unknown,
  session?: ClientSession
) {
  const actor = userIdSchema.parse(actorInput)
  const operation = syncOperationSchema.parse(operationInput)
  const receipt = await readRemoteRecurringOperationReceipt(
    actor,
    operation.operationId,
    session
  )
  if (!receipt) return null
  if (receipt.fingerprint !== syncOperationFingerprint(operation))
    throw new OperationIdentityReuseError()
  return receipt.result
}
