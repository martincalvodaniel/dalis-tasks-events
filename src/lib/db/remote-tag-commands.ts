import "server-only"

import { randomUUID } from "node:crypto"
import { type ClientSession, type Document, MongoServerError } from "mongodb"
import { getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { readRemoteOperationReplay } from "@/lib/db/remote-operation-receipts"
import { RemoteTagRepository } from "@/lib/db/remote-tags"
import { planRemoteTagOperation } from "@/lib/preferences/remote-tag-plan"
import { syncOperationFingerprint } from "@/lib/sync/operation-fingerprint"
import { remotePreferenceEffectsSchema } from "@/schemas/preference-effects"
import {
  revisionSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { remoteChangeV2Schema } from "@/schemas/remote-change-v2"
import { remoteOperationReceiptV2Schema } from "@/schemas/remote-operation-receipt-v2"
import { syncOperationSchema } from "@/schemas/sync"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"

class TagCompareAndSwapError extends Error {}

// This stage is not an ACK: only its transaction owner can confirm a committed result.
export async function stageRemoteTagOperation(
  actorInput: unknown,
  operationInput: unknown,
  timestampInput: unknown,
  session: ClientSession
): Promise<RemoteOperationResultV2> {
  const actor = userIdSchema.parse(actorInput)
  const operation = syncOperationSchema.parse(operationInput)
  const now = timestampSchema.parse(timestampInput)
  if (!session.inTransaction())
    throw new Error("Category operations require an active transaction")
  const replay = await readRemoteOperationReplay(actor, operation, session)
  if (replay) return replay
  const command = operation.command
  const rejected = (
    status: "unsupported" | "unavailable" | "invalid_command"
  ): RemoteOperationResultV2 => ({
    kind: "preference",
    outcome: { operationId: operation.operationId, status },
  })
  if (!["tag.save", "tag.delete", "tag.move"].includes(command.type))
    return rejected("unsupported")
  const repository = await RemoteTagRepository.open(actor, session)
  const tags = await repository.catalog()
  const planned = planRemoteTagOperation({
    userId: actor,
    timestamp: now,
    operation,
    tags,
  })
  let result: RemoteOperationResultV2
  if (planned.status === "changes") {
    const previous = new Map(tags.map((tag) => [tag.id, tag]))
    for (const effect of planned.effects) {
      if (effect.store !== "tags")
        throw new Error("Category plan contains a foreign effect")
      const base = previous.get(effect.record.id)
      const written = base
        ? await repository.replace(base.revision, effect.record)
        : await repository.insert(effect.record)
      if (!written)
        throw new TagCompareAndSwapError(
          "Remote category changed during the transaction"
        )
    }
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
      effects: planned.effects,
    })
    const change = remoteChangeV2Schema.parse({
      version: 2,
      kind: "preference",
      recipientUserId: actor,
      operationId: operation.operationId,
      sequence,
      effects,
    })
    const changes = await getCollection<Document & { _id: string }>(
      COLLECTION_NAMES.syncChanges
    )
    await changes.insertOne({ ...change, _id: randomUUID() }, { session })
    result = {
      kind: "preference",
      outcome: {
        operationId: operation.operationId,
        status: "applied",
        effects,
      },
    }
  } else if (planned.status === "conflict") {
    result = {
      kind: "preference",
      outcome: {
        operationId: operation.operationId,
        status: "conflict",
        current: { store: "tags", record: planned.current },
      },
    }
  } else result = rejected(planned.status)
  const receipt = remoteOperationReceiptV2Schema.parse({
    version: 2,
    actorUserId: actor,
    operationId: operation.operationId,
    fingerprint: syncOperationFingerprint(operation),
    result,
    createdAt: now,
  })
  const receipts = await getCollection<Document & { _id: string }>(
    COLLECTION_NAMES.syncOperations
  )
  await receipts.insertOne({ ...receipt, _id: randomUUID() }, { session })
  return receipt.result
}

// Only an authenticated service may supply the actor; this preparatory executor has no product callers.
export async function executeRemoteTagOperation(
  actorInput: unknown,
  operationInput: unknown
): Promise<RemoteOperationResultV2> {
  const actor = userIdSchema.parse(actorInput)
  const operation = syncOperationSchema.parse(operationInput)
  const now = new Date().toISOString()
  const database = await getDatabase()
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await database.client.withSession((session) =>
        session.withTransaction(
          () => stageRemoteTagOperation(actor, operation, now, session),
          {
            readConcern: { level: "snapshot" },
            writeConcern: { w: "majority" },
            readPreference: "primary",
            timeoutMS: 15000,
          }
        )
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
        (!insertRace && !(error instanceof TagCompareAndSwapError))
      )
        throw error
    }
  }
  throw new Error("Remote category operation retry limit reached")
}
