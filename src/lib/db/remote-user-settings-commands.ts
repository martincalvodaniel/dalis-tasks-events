import "server-only"

import type { ClientSession } from "mongodb"
import {
  PreferenceCompareAndSwapError,
  runPreferenceTransaction,
  stagePreferenceJournal,
  stagePreferenceReceipt,
} from "@/lib/db/remote-preference-transactions"
import { readRemoteRecurringOperationReplay } from "@/lib/db/remote-recurring-operation-receipts"
import { RemoteUserSettingsRepository } from "@/lib/db/remote-user-settings"
import { planRemoteUserSettingsOperation } from "@/lib/preferences/remote-user-settings-plan"
import { validateRemoteRecurringOperationResult } from "@/lib/sync/remote-recurring-push"
import { timestampSchema, userIdSchema } from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"

// Preparatory only: the authenticated transaction owner must commit before returning an ACK.
export async function stageRemoteUserSettingsOperation(
  actorInput: unknown,
  operationInput: unknown,
  timestampInput: unknown,
  session: ClientSession
): Promise<RemoteOperationResultV2> {
  const actor = userIdSchema.parse(actorInput)
  const operation = syncOperationSchema.parse(operationInput)
  const now = timestampSchema.parse(timestampInput)
  if (!session.inTransaction())
    throw new Error("Personal settings writes require an active transaction")
  const replay = await readRemoteRecurringOperationReplay(
    actor,
    operation,
    session
  )
  if (replay) {
    const validated = validateRemoteRecurringOperationResult(
      replay,
      actor,
      operation
    )
    if (validated.kind === "plan-occurrence")
      throw new Error(
        "Stored receipt is incompatible with the personal settings executor"
      )
    return validated
  }
  if (operation.command.type !== "settings.update")
    return {
      kind: "preference",
      outcome: { operationId: operation.operationId, status: "unsupported" },
    }
  const repository = await RemoteUserSettingsRepository.open(actor, session)
  const current = await repository.read()
  const plan = planRemoteUserSettingsOperation({
    userId: actor,
    operation,
    timestamp: now,
    current,
  })
  let result: RemoteOperationResultV2
  if (plan.status === "changes") {
    const effect = plan.effects[0]
    if (plan.effects.length !== 1 || effect.store !== "settings")
      throw new Error("Personal settings plan contains a foreign effect")
    const written = current
      ? await repository.replace(current.revision, effect.record)
      : await repository.insert(effect.record)
    if (!written)
      throw new PreferenceCompareAndSwapError(
        "Personal settings changed during the transaction"
      )
    result = await stagePreferenceJournal(
      actor,
      operation,
      plan.effects,
      session
    )
  } else if (plan.status === "conflict" && plan.current) {
    result = {
      kind: "preference",
      outcome: {
        operationId: operation.operationId,
        status: "conflict",
        current: { store: "settings", record: plan.current },
      },
    }
  } else {
    result = {
      kind: "preference",
      outcome: {
        operationId: operation.operationId,
        status: plan.status === "conflict" ? "unavailable" : plan.status,
      },
    }
  }
  return stagePreferenceReceipt(actor, operation, result, now, session)
}

export function executeRemoteUserSettingsOperation(
  actorInput: unknown,
  operationInput: unknown
) {
  return runPreferenceTransaction(
    actorInput,
    operationInput,
    stageRemoteUserSettingsOperation
  )
}
