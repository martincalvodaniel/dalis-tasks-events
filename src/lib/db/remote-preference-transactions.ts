import "server-only"

import { randomUUID } from "node:crypto"
import { type ClientSession, type Document, MongoServerError } from "mongodb"
import { getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { syncOperationFingerprint } from "@/lib/sync/operation-fingerprint"
import { remotePreferenceEffectsSchema } from "@/schemas/preference-effects"
import { revisionSchema, userIdSchema } from "@/schemas/primitives"
import { remoteChangeV2Schema } from "@/schemas/remote-change-v2"
import { remoteOperationReceiptV2Schema } from "@/schemas/remote-operation-receipt-v2"
import { syncOperationSchema } from "@/schemas/sync"
import type { PreferenceEffect } from "@/types/preference-effects"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"
import type { SyncOperation } from "@/types/sync"

export class PreferenceCompareAndSwapError extends Error {}

function requireTransaction(session: ClientSession) {
  if (!session.inTransaction())
    throw new Error("Preference writes require an active transaction")
}

// All document effects must already be staged in this session. No ACK before commit.
export async function stagePreferenceJournal(
  actor: string,
  operation: SyncOperation,
  records: PreferenceEffect[],
  session: ClientSession
): Promise<RemoteOperationResultV2> {
  requireTransaction(session)
  const counters = await getCollection<{ _id: string; sequence: number }>(
    COLLECTION_NAMES.syncCounters
  )
  const counter = await counters.findOneAndUpdate(
    { _id: actor },
    { $inc: { sequence: 1 } },
    { upsert: true, returnDocument: "after", session }
  )
  const sequence = revisionSchema.min(1).parse(counter?.sequence)
  const effects = remotePreferenceEffectsSchema.parse({
    version: 1,
    userId: actor,
    operationId: operation.operationId,
    sequence,
    effects: records,
  })
  const change = remoteChangeV2Schema.parse({
    version: 2,
    kind: "preference",
    recipientUserId: actor,
    operationId: operation.operationId,
    sequence,
    effects,
  })
  await (
    await getCollection<Document & { _id: string }>(
      COLLECTION_NAMES.syncChanges
    )
  ).insertOne({ ...change, _id: randomUUID() }, { session })
  return {
    kind: "preference",
    outcome: { operationId: operation.operationId, status: "applied", effects },
  }
}

export async function stagePreferenceReceipt(
  actor: string,
  operation: SyncOperation,
  result: RemoteOperationResultV2,
  now: string,
  session: ClientSession
): Promise<RemoteOperationResultV2> {
  requireTransaction(session)
  const receipt = remoteOperationReceiptV2Schema.parse({
    version: 2,
    actorUserId: actor,
    operationId: operation.operationId,
    fingerprint: syncOperationFingerprint(operation),
    result,
    createdAt: now,
  })
  await (
    await getCollection<Document & { _id: string }>(
      COLLECTION_NAMES.syncOperations
    )
  ).insertOne({ ...receipt, _id: randomUUID() }, { session })
  return receipt.result
}

export async function runPreferenceTransaction(
  actorInput: unknown,
  operationInput: unknown,
  stage: (
    actor: string,
    operation: SyncOperation,
    now: string,
    session: ClientSession
  ) => Promise<RemoteOperationResultV2>
): Promise<RemoteOperationResultV2> {
  const actor = userIdSchema.parse(actorInput)
  const operation = syncOperationSchema.parse(operationInput)
  const now = new Date().toISOString()
  const database = await getDatabase()
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await database.client.withSession((session) =>
        session.withTransaction(() => stage(actor, operation, now, session), {
          readConcern: { level: "snapshot" },
          writeConcern: { w: "majority" },
          readPreference: "primary",
          timeoutMS: 15000,
        })
      )
    } catch (error) {
      const insertRace =
        error instanceof MongoServerError &&
        error.code === 11000 &&
        (error.keyPattern?._id === 1 ||
          error.keyPattern?.actorUserId === 1 ||
          error.keyPattern?.userId === 1)
      if (
        attempt === 2 ||
        (!insertRace && !(error instanceof PreferenceCompareAndSwapError))
      )
        throw error
    }
  }
  throw new Error("Remote preference operation retry limit reached")
}
