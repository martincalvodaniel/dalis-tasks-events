import "server-only"

import type { ClientSession } from "mongodb"
import { readRemoteOperationReplay } from "@/lib/db/remote-operation-receipts"
import {
  PreferenceCompareAndSwapError,
  runPreferenceTransaction,
  stagePreferenceJournal,
  stagePreferenceReceipt,
} from "@/lib/db/remote-preference-transactions"
import { readRemoteRecurringOperationReplay } from "@/lib/db/remote-recurring-operation-receipts"
import { RemoteTagRepository } from "@/lib/db/remote-tags"
import { planRemoteTagOperation } from "@/lib/preferences/remote-tag-plan"
import { timestampSchema, userIdSchema } from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"

// This stage is not an ACK: only its transaction owner can confirm a committed result.
export async function stageRemoteTagOperation(
  actorInput: unknown,
  operationInput: unknown,
  timestampInput: unknown,
  session: ClientSession
): Promise<RemoteOperationResultV2> {
  return stageTagOperation(
    actorInput,
    operationInput,
    timestampInput,
    session,
    false
  )
}

// Future receipt scope only; the transaction owner must commit before acknowledging.
export function stageRemoteRecurringTagOperation(
  actorInput: unknown,
  operationInput: unknown,
  timestampInput: unknown,
  session: ClientSession
): Promise<RemoteOperationResultV2> {
  return stageTagOperation(
    actorInput,
    operationInput,
    timestampInput,
    session,
    true
  )
}

async function stageTagOperation(
  actorInput: unknown,
  operationInput: unknown,
  timestampInput: unknown,
  session: ClientSession,
  allowSeries: boolean
): Promise<RemoteOperationResultV2> {
  const actor = userIdSchema.parse(actorInput)
  const operation = syncOperationSchema.parse(operationInput)
  const now = timestampSchema.parse(timestampInput)
  if (!session.inTransaction())
    throw new Error("Category operations require an active transaction")
  const replay = await (allowSeries
    ? readRemoteRecurringOperationReplay(actor, operation, session)
    : readRemoteOperationReplay(actor, operation, session))
  if (replay) {
    if (replay.kind === "plan-occurrence")
      throw new Error(
        "Stored receipt is incompatible with the category executor"
      )
    return replay
  }
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
        throw new PreferenceCompareAndSwapError(
          "Remote category changed during the transaction"
        )
    }
    result = await stagePreferenceJournal(
      actor,
      operation,
      planned.effects,
      session
    )
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
  return stagePreferenceReceipt(actor, operation, result, now, session)
}

// Only an authenticated service may supply the actor.
export async function executeRemoteTagOperation(
  actorInput: unknown,
  operationInput: unknown
): Promise<RemoteOperationResultV2> {
  return runPreferenceTransaction(
    actorInput,
    operationInput,
    stageRemoteTagOperation
  )
}

// Prepared for the recurring dispatcher; active callers retain their strict reader.
export function executeRemoteRecurringTagOperation(
  actorInput: unknown,
  operationInput: unknown
): Promise<RemoteOperationResultV2> {
  return runPreferenceTransaction(
    actorInput,
    operationInput,
    stageRemoteRecurringTagOperation
  )
}
