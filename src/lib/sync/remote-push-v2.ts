import { placementDate } from "@/schemas/ordering"
import { userIdSchema } from "@/schemas/primitives"
import { remoteOperationResultOwner } from "@/schemas/remote-operation-result-v2"
import {
  remotePushInputV2Schema,
  remotePushResultV2Schema,
} from "@/schemas/remote-push-v2"
import type { PreferenceEffect } from "@/types/preference-effects"
import type { RemotePushResultV2 } from "@/types/remote-push-v2"
import type { SyncCommand } from "@/types/sync"

export function remoteOperationKind(
  command: SyncCommand
): "item" | "preference" {
  return [
    "tag.save",
    "tag.delete",
    "tag.move",
    "item-view.set",
    "task.move",
    "settings.update",
  ].includes(command.type)
    ? "preference"
    : "item"
}

function matchesPreferenceTarget(
  effect: PreferenceEffect,
  command: SyncCommand
): boolean {
  switch (command.type) {
    case "tag.save":
    case "tag.delete":
    case "tag.move":
      return effect.store === "tags" && effect.record.id === command.tagId
    case "item-view.set":
      return (
        effect.store === "itemViews" && effect.record.itemId === command.itemId
      )
    case "task.move":
      return (
        effect.store === "taskPlacements" &&
        effect.record.occurrenceId ===
          (command.occurrenceId ?? command.itemId) &&
        effect.record.scope === command.scope &&
        effect.record.date === placementDate(command.scope, command.date)
      )
    case "settings.update":
      return effect.store === "settings"
    default:
      return false
  }
}

// This validates correspondence only; application and ACK require a durable local transaction.
export function validateRemotePushResultV2(
  input: unknown,
  expectedUserIdInput: unknown,
  requestInput: unknown
): RemotePushResultV2 {
  const actor = userIdSchema.parse(expectedUserIdInput)
  const request = remotePushInputV2Schema.parse(requestInput)
  if (request.expectedUserId !== actor)
    throw new Error("Mixed push request belongs to another account")
  const response = remotePushResultV2Schema.parse(input)
  if (!("results" in response)) return response
  if (
    response.status === "complete" &&
    response.results.length !== request.operations.length
  )
    throw new Error("Mixed push response does not complete its request")
  if (
    response.status === "retry_later" &&
    (response.results.length >= request.operations.length ||
      response.failedOperationId !==
        request.operations[response.results.length].operationId)
  )
    throw new Error("Mixed push retry does not match its request prefix")
  for (const [index, result] of response.results.entries()) {
    const operation = request.operations[index]
    const owner = remoteOperationResultOwner(result)
    if (
      !operation ||
      result.outcome.operationId !== operation.operationId ||
      result.kind !== remoteOperationKind(operation.command)
    )
      throw new Error("Mixed push result does not match its operation")
    if (owner !== undefined && owner !== actor)
      throw new Error("Mixed push result belongs to another account")
    if (
      result.kind === "item" &&
      (result.outcome.status === "applied" ||
        result.outcome.status === "conflict")
    ) {
      const record =
        result.outcome.status === "applied"
          ? result.outcome.item
          : result.outcome.current
      if (
        !("itemId" in operation.command) ||
        record.id !== operation.command.itemId
      )
        throw new Error("Mixed push result targets another item")
    } else if (result.kind === "preference") {
      if (
        result.outcome.status === "applied" &&
        !result.outcome.effects.effects.some((effect) =>
          matchesPreferenceTarget(effect, operation.command)
        )
      )
        throw new Error("Mixed push effects omit their command target")
      if (
        result.outcome.status === "conflict" &&
        !matchesPreferenceTarget(result.outcome.current, operation.command)
      )
        throw new Error("Mixed push conflict targets another preference")
    }
  }
  return response
}
