import { decodeLocalItemOutcome } from "@/lib/sync/local-item-outcome-v2"
import { validatePersonalSnapshot } from "@/lib/sync/personal-snapshot"
import { validateRemotePushResultV2 } from "@/lib/sync/remote-push-v2"
import {
  localPreferenceOutcomeV2Schema,
  maximumLocalOperationOutcomeBytes,
} from "@/schemas/local-preference-outcome-v2"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import { preferenceEffectSchema } from "@/schemas/preference-effects"
import { userIdSchema } from "@/schemas/primitives"
import { personalShadowEntityKey } from "@/schemas/remote-shadow-v2"
import type {
  LocalOperationOutcomeV2,
  LocalPreferenceOutcomeV2,
} from "@/types/local-operation-outcome-v2"
import type { SyncCommand } from "@/types/sync"

function primaryPreferenceKey(command: SyncCommand, actor: string): string {
  switch (command.type) {
    case "tag.save":
    case "tag.delete":
    case "tag.move":
      return `tag:${command.tagId}`
    case "item-view.set":
      return `item-view:${command.itemId}`
    case "task.move":
      return taskPlacementEntityKey(
        command.occurrenceId ?? command.itemId,
        command.scope,
        command.date
      )
    case "settings.update":
      return `settings:${actor}`
    default:
      throw new Error("Preference outcome requires a personal identity")
  }
}

export function validateLocalPreferenceOutcomeV2(
  input: unknown,
  expectedUserIdInput: unknown
): LocalPreferenceOutcomeV2 {
  const actor = userIdSchema.parse(expectedUserIdInput)
  const value = localPreferenceOutcomeV2Schema.parse(input)
  validateRemotePushResultV2(
    { transportVersion: 2, status: "complete", results: [value.result] },
    actor,
    {
      transportVersion: 2,
      expectedUserId: actor,
      operations: [value.operation],
    }
  )
  const keys = new Set([primaryPreferenceKey(value.operation.command, actor)])
  const outcome = value.result.outcome
  if (outcome.status === "applied")
    for (const effect of outcome.effects.effects)
      keys.add(personalShadowEntityKey(effect))
  else if (outcome.status === "conflict")
    keys.add(personalShadowEntityKey(outcome.current))
  const identities = [...keys]
  validatePersonalSnapshot(value.local, actor, identities)
  validatePersonalSnapshot(value.base, actor, identities)
  for (const entry of value.base)
    if (entry.record) preferenceEffectSchema.parse(entry.record)
  // Observed remote bases are evidence, not necessarily ancestors of the intention or replay.
  return value
}

// Reading evidence is readonly and cannot confirm a lease, an ACK or access rights.
export function decodeLocalOperationOutcome(
  input: unknown,
  expectedUserIdInput: unknown
): LocalOperationOutcomeV2 {
  if (
    new TextEncoder().encode(JSON.stringify(input)).byteLength >
    maximumLocalOperationOutcomeBytes
  )
    throw new Error("Stored operation outcome exceeds its byte limit")
  const preference = localPreferenceOutcomeV2Schema.safeParse(input)
  if (preference.success)
    return validateLocalPreferenceOutcomeV2(
      preference.data,
      expectedUserIdInput
    )
  return decodeLocalItemOutcome(input, expectedUserIdInput)
}
