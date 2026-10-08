import "server-only"

import type { ClientSession } from "mongodb"
import { RemoteItemViewRepository } from "@/lib/db/remote-item-views"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { readRemoteOperationReplay } from "@/lib/db/remote-operation-receipts"
import {
  PreferenceCompareAndSwapError,
  runPreferenceTransaction,
  stagePreferenceJournal,
  stagePreferenceReceipt,
} from "@/lib/db/remote-preference-transactions"
import { RemoteTagRepository } from "@/lib/db/remote-tags"
import { planRemoteItemViewOperation } from "@/lib/preferences/remote-item-view-plan"
import { timestampSchema, userIdSchema } from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"

// A staged result is not an ACK; the owner must commit the complete transaction.
export async function stageRemoteItemViewOperation(
  actorInput: unknown,
  operationInput: unknown,
  timestampInput: unknown,
  session: ClientSession
): Promise<RemoteOperationResultV2> {
  const actor = userIdSchema.parse(actorInput)
  const operation = syncOperationSchema.parse(operationInput)
  const now = timestampSchema.parse(timestampInput)
  if (!session.inTransaction())
    throw new Error("Item view operations require an active transaction")
  const replay = await readRemoteOperationReplay(actor, operation, session)
  if (replay) return replay
  const command = operation.command
  if (command.type !== "item-view.set")
    return {
      kind: "preference",
      outcome: { operationId: operation.operationId, status: "unsupported" },
    }
  const repository = await RemoteItemViewRepository.open(actor, session)
  const item = await (await RemoteItemRepository.open(actor, session)).read(
    command.itemId
  )
  const current = await repository.read(command.itemId)
  const tag =
    command.primaryTagId === null
      ? null
      : await (await RemoteTagRepository.open(actor, session)).read(
          command.primaryTagId
        )
  const planned = planRemoteItemViewOperation({
    userId: actor,
    timestamp: now,
    operation,
    item,
    current,
    tag,
  })
  let result: RemoteOperationResultV2
  if (planned.status === "changes") {
    for (const effect of planned.effects) {
      if (effect.store !== "itemViews")
        throw new Error("Item view plan contains a foreign effect")
      const written = current
        ? await repository.replace(current.revision, effect.record)
        : await repository.insert(effect.record)
      if (!written)
        throw new PreferenceCompareAndSwapError(
          "Remote item view changed during the transaction"
        )
    }
    result = await stagePreferenceJournal(
      actor,
      operation,
      planned.effects,
      session
    )
  } else if (planned.status === "conflict")
    result = {
      kind: "preference",
      outcome: {
        operationId: operation.operationId,
        status: "conflict",
        current: { store: "itemViews", record: planned.current },
      },
    }
  else
    result = {
      kind: "preference",
      outcome: { operationId: operation.operationId, status: planned.status },
    }
  return stagePreferenceReceipt(actor, operation, result, now, session)
}

// Actor identity must come from an authenticated service. No production callers yet.
export function executeRemoteItemViewOperation(
  actorInput: unknown,
  operationInput: unknown
): Promise<RemoteOperationResultV2> {
  return runPreferenceTransaction(
    actorInput,
    operationInput,
    stageRemoteItemViewOperation
  )
}
