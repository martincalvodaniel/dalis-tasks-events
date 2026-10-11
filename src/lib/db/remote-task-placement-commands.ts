import "server-only"

import type { ClientSession } from "mongodb"
import { RemoteItemViewRepository } from "@/lib/db/remote-item-views"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { readRemoteOperationReplay } from "@/lib/db/remote-operation-receipts"
import { RemotePlanOccurrenceRepository } from "@/lib/db/remote-plan-occurrences"
import { writeRemotePlanSeriesGuard } from "@/lib/db/remote-plan-series-guard"
import {
  PreferenceCompareAndSwapError,
  runPreferenceTransaction,
  stagePreferenceJournal,
  stagePreferenceReceipt,
} from "@/lib/db/remote-preference-transactions"
import { readRemoteRecurringOperationReplay } from "@/lib/db/remote-recurring-operation-receipts"
import { RemoteTagRepository } from "@/lib/db/remote-tags"
import { RemoteTaskPlacementRepository } from "@/lib/db/remote-task-placements"
import { planRemoteRecurringTaskPlacementOperation } from "@/lib/preferences/remote-recurring-task-placement-plan"
import { planRemoteTaskPlacementOperation } from "@/lib/preferences/remote-task-placement-plan"
import { preferenceEffectKey } from "@/schemas/preference-effects"
import { timestampSchema, userIdSchema } from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"

// A staged result is not an ACK; the owner must commit the complete transaction.
export async function stageRemoteTaskPlacementOperation(
  actorInput: unknown,
  operationInput: unknown,
  timestampInput: unknown,
  session: ClientSession,
  allowPlans = false
): Promise<RemoteOperationResultV2> {
  return stageTaskPlacementOperation(
    actorInput,
    operationInput,
    timestampInput,
    session,
    allowPlans,
    false
  )
}

// Future scope only; the transaction owner must commit before acknowledging.
export function stageRemoteRecurringTaskPlacementOperation(
  actorInput: unknown,
  operationInput: unknown,
  timestampInput: unknown,
  session: ClientSession
): Promise<RemoteOperationResultV2> {
  return stageTaskPlacementOperation(
    actorInput,
    operationInput,
    timestampInput,
    session,
    true,
    true
  )
}

async function stageTaskPlacementOperation(
  actorInput: unknown,
  operationInput: unknown,
  timestampInput: unknown,
  session: ClientSession,
  allowPlans: boolean,
  allowSeries: boolean
): Promise<RemoteOperationResultV2> {
  const actor = userIdSchema.parse(actorInput)
  const operation = syncOperationSchema.parse(operationInput)
  const now = timestampSchema.parse(timestampInput)
  if (!session.inTransaction())
    throw new Error("Task placement operations require an active transaction")
  const replay = await (allowSeries
    ? readRemoteRecurringOperationReplay(actor, operation, session)
    : readRemoteOperationReplay(actor, operation, session))
  if (replay) {
    if (replay.kind === "plan-occurrence")
      throw new Error(
        "Stored receipt is incompatible with the placement executor"
      )
    if (!allowPlans && operation.command.type === "task.move") {
      const repository = await RemoteItemRepository.open(actor, session)
      const target = await repository.read(operation.command.itemId)
      let containsPlan = target?.kind === "plan"
      if (replay.kind === "preference" && replay.outcome.status === "applied")
        for (const effect of replay.outcome.effects.effects) {
          const itemId =
            effect.store === "taskPlacements"
              ? effect.record.occurrenceId
              : effect.store === "itemViews"
                ? effect.record.itemId
                : null
          if (itemId && (await repository.read(itemId))?.kind === "plan")
            containsPlan = true
        }
      if (containsPlan)
        return {
          kind: "preference",
          outcome: {
            operationId: operation.operationId,
            status: "unsupported",
          },
        }
    }
    return replay
  }
  if (operation.command.type !== "task.move")
    return {
      kind: "preference",
      outcome: { operationId: operation.operationId, status: "unsupported" },
    }
  const command = operation.command

  const itemRepository = await RemoteItemRepository.open(actor, session)
  const tagRepository = await RemoteTagRepository.open(actor, session)
  const viewRepository = await RemoteItemViewRepository.open(actor, session)
  const placementRepository = await RemoteTaskPlacementRepository.open(
    actor,
    session
  )
  // MongoDB session operations are sequential and share one bounded snapshot.
  const items = await itemRepository.catalog()
  if (
    !allowPlans &&
    items.find((item) => item.id === command.itemId)?.kind === "plan"
  )
    return {
      kind: "preference",
      outcome: { operationId: operation.operationId, status: "unsupported" },
    }
  const tags = await tagRepository.catalog()
  const views = await viewRepository.catalog()
  const placements = await placementRepository.catalog()
  const input = {
    userId: actor,
    timestamp: now,
    operation,
    items,
    tags,
    views,
    placements,
  }
  const planned = allowSeries
    ? planRemoteRecurringTaskPlacementOperation({
        ...input,
        occurrences: await (
          await RemotePlanOccurrenceRepository.open(actor, session)
        ).catalog(),
      })
    : planRemoteTaskPlacementOperation(input, allowPlans)
  let result: RemoteOperationResultV2
  if (planned.status === "changes") {
    if (allowSeries) {
      const parents = new Map(items.map((item) => [item.id, item]))
      const guarded = new Set<string>()
      for (const effect of planned.effects) {
        const parentId =
          effect.store === "taskPlacements"
            ? effect.record.occurrenceId.split(":")[0]
            : effect.store === "itemViews"
              ? effect.record.itemId
              : null
        if (!parentId || !parents.has(parentId))
          throw new Error("Recurring placement effect has no owned parent")
        if (parents.get(parentId)?.kind === "plan") guarded.add(parentId)
      }
      // Stable acquisition order; every participating series shares its guard with content writers.
      for (const parentId of [...guarded].sort())
        await writeRemotePlanSeriesGuard(actor, parentId, session)
    }
    const previousPlacements = new Map(
      placements.map((record) => [
        preferenceEffectKey({ store: "taskPlacements", record }),
        record,
      ])
    )
    const previousViews = new Map(
      views.map((record) => [record.itemId, record])
    )
    for (const effect of planned.effects) {
      let written: boolean
      if (effect.store === "taskPlacements") {
        const previous = previousPlacements.get(preferenceEffectKey(effect))
        written = previous
          ? await placementRepository.replace(previous.revision, effect.record)
          : await placementRepository.insert(effect.record)
      } else if (effect.store === "itemViews") {
        const previous = previousViews.get(effect.record.itemId)
        written = previous
          ? await viewRepository.replace(previous.revision, effect.record)
          : await viewRepository.insert(effect.record)
      } else throw new Error("Task placement plan contains a foreign effect")
      if (!written)
        throw new PreferenceCompareAndSwapError(
          "Remote task placement context changed during the transaction"
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
        current: { store: "taskPlacements", record: planned.current },
      },
    }
  else
    result = {
      kind: "preference",
      outcome: { operationId: operation.operationId, status: planned.status },
    }
  return stagePreferenceReceipt(actor, operation, result, now, session)
}

// The authenticated dispatcher remains disconnected until readers and clients are compatible.
export function executeRemoteTaskPlacementOperation(
  actorInput: unknown,
  operationInput: unknown
): Promise<RemoteOperationResultV2> {
  return runPreferenceTransaction(
    actorInput,
    operationInput,
    stageRemoteTaskPlacementOperation
  )
}

export function executeRemotePlanTaskPlacementOperation(
  actorInput: unknown,
  operationInput: unknown
): Promise<RemoteOperationResultV2> {
  return runPreferenceTransaction(
    actorInput,
    operationInput,
    (actor, operation, timestamp, session) =>
      stageRemoteTaskPlacementOperation(
        actor,
        operation,
        timestamp,
        session,
        true
      )
  )
}

// Prepared for the future recurring dispatcher; current callers remain strict.
export function executeRemoteRecurringTaskPlacementOperation(
  actorInput: unknown,
  operationInput: unknown
): Promise<RemoteOperationResultV2> {
  return runPreferenceTransaction(
    actorInput,
    operationInput,
    stageRemoteRecurringTaskPlacementOperation
  )
}
