import "server-only"

import { randomUUID } from "node:crypto"
import type { ClientSession, Document } from "mongodb"
import { planRemotePlanOccurrenceOperation } from "@/lib/calendar/remote-plan-occurrence-plan"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { RemotePlanOccurrenceRepository } from "@/lib/db/remote-plan-occurrences"
import { writeRemotePlanSeriesGuard } from "@/lib/db/remote-plan-series-guard"
import {
  PreferenceCompareAndSwapError,
  runPreferenceTransaction,
} from "@/lib/db/remote-preference-transactions"
import { readRemoteRecurringOperationReplay } from "@/lib/db/remote-recurring-operation-receipts"
import { syncOperationFingerprint } from "@/lib/sync/operation-fingerprint"
import { revisionSchema } from "@/schemas/primitives"
import { remotePlanOccurrenceOperationSchema } from "@/schemas/remote-plan-occurrence-planning"
import {
  remotePlanOccurrenceChangeSchema,
  remotePlanOccurrenceResultSchema,
  remoteRecurringOperationReceiptSchema,
} from "@/schemas/remote-plan-occurrence-result"
import { remotePlanOccurrenceKeySchema } from "@/schemas/remote-plan-occurrence-storage"
import type { PlanOccurrence } from "@/types/plan-occurrence"
import type { RemotePlanOccurrenceResult } from "@/types/remote-recurring-sync"
import type { SyncOperation } from "@/types/sync"

async function stageJournal(
  actor: string,
  operation: SyncOperation,
  occurrence: PlanOccurrence,
  seriesRevision: number,
  session: ClientSession
): Promise<RemotePlanOccurrenceResult> {
  const counter = await (
    await getCollection<{ _id: string; sequence: number }>(
      COLLECTION_NAMES.syncCounters
    )
  ).findOneAndUpdate(
    { _id: actor },
    { $inc: { sequence: 1 } },
    { upsert: true, returnDocument: "after", session }
  )
  const sequence = revisionSchema.min(1).parse(counter?.sequence)
  const change = remotePlanOccurrenceChangeSchema.parse({
    version: 2,
    kind: "plan-occurrence",
    recipientUserId: actor,
    operationId: operation.operationId,
    sequence,
    seriesRevision,
    occurrence,
  })
  await (
    await getCollection<Document & { _id: string }>(
      COLLECTION_NAMES.syncChanges
    )
  ).insertOne({ ...change, _id: randomUUID() }, { session })
  return remotePlanOccurrenceResultSchema.parse({
    kind: "plan-occurrence",
    userId: actor,
    outcome: {
      operationId: operation.operationId,
      status: "applied",
      occurrence,
      seriesRevision,
      sequence,
    },
  })
}

async function stage(
  actor: string,
  operation: SyncOperation,
  now: string,
  session: ClientSession
): Promise<RemotePlanOccurrenceResult> {
  const replay = await readRemoteRecurringOperationReplay(
    actor,
    operation,
    session
  )
  if (replay) {
    if (replay.kind !== "plan-occurrence")
      throw new Error(
        "Stored receipt is incompatible with the appearance executor"
      )
    return replay
  }
  const terminal = (
    status: "unsupported" | "unavailable" | "invalid_command"
  ) =>
    remotePlanOccurrenceResultSchema.parse({
      kind: "plan-occurrence",
      userId: actor,
      outcome: { operationId: operation.operationId, status },
    })
  const parsed = remotePlanOccurrenceOperationSchema.safeParse(operation)
  if (!parsed.success) return terminal("unsupported")
  const command = parsed.data.command
  const item = await (await RemoteItemRepository.open(actor, session)).read(
    command.itemId
  )
  const series = item?.kind === "plan" ? item : null
  // Read appearances only after authorizing the current parent in this snapshot.
  const occurrences = await RemotePlanOccurrenceRepository.open(actor, session)
  const key = remotePlanOccurrenceKeySchema.safeParse({
    seriesId: command.itemId,
    id: command.occurrenceId,
  })
  const current =
    series &&
    series.ownerId === actor &&
    !series.deletedAt &&
    series.recurrence &&
    key.success
      ? await occurrences.read(key.data)
      : null
  const plan = planRemotePlanOccurrenceOperation({
    userId: actor,
    timestamp: now,
    operation: parsed.data,
    series,
    current,
  })
  let result: RemotePlanOccurrenceResult
  if (plan.status === "changes") {
    await writeRemotePlanSeriesGuard(actor, plan.record.seriesId, session)
    const written = plan.currentExists
      ? await occurrences.replace(plan.expectedOccurrenceRevision, plan.record)
      : await occurrences.insert(plan.record)
    if (!written)
      throw new PreferenceCompareAndSwapError(
        "Remote appearance changed during the transaction"
      )
    result = await stageJournal(
      actor,
      operation,
      plan.record,
      plan.expectedSeriesRevision,
      session
    )
  } else if (plan.status === "conflict") {
    result = remotePlanOccurrenceResultSchema.parse({
      kind: "plan-occurrence",
      userId: actor,
      outcome: { operationId: operation.operationId, ...plan },
    })
  } else result = terminal(plan.status)
  const receipt = remoteRecurringOperationReceiptSchema.parse({
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
  return remotePlanOccurrenceResultSchema.parse(receipt.result)
}

// Only a future authenticated dispatcher may supply the actor; no active caller yet.
export async function executeRemotePlanOccurrenceOperation(
  actorInput: unknown,
  operationInput: unknown
): Promise<RemotePlanOccurrenceResult> {
  return runPreferenceTransaction(actorInput, operationInput, stage)
}
