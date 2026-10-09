import {
  decodeLocalOperationOutcome,
  validateLocalPreferenceOutcomeV2,
} from "@/lib/sync/local-operation-outcome-v2"
import { validateLocalSyncResultInputV2 } from "@/lib/sync/local-sync-result-v2"
import { planRemotePreferenceProjection } from "@/lib/sync/preference-projection"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import { preferenceResultPlanInputSchema } from "@/schemas/preference-result-plan"
import { personalShadowEntityKey } from "@/schemas/remote-shadow-v2"
import type { LocalPreferenceOutcomeV2 } from "@/types/local-operation-outcome-v2"
import type { OutboxEntry } from "@/types/local-sync"
import type { PersonalSnapshot } from "@/types/personal-snapshot"
import type { RemoteShadowV2 } from "@/types/remote-shadow-v2"
import type { SyncCommand } from "@/types/sync"

type PersonalShadow = Extract<RemoteShadowV2, { kind: "preference" }>

function primaryResultKey(command: SyncCommand): string {
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
    default:
      throw new Error(
        "Personal result application does not support this command"
      )
  }
}
export interface PreferenceResultPlan {
  status: "applied" | "replayed"
  local: PersonalSnapshot
  shadows: PersonalShadow[]
  entries: OutboxEntry[]
  outcome: LocalPreferenceOutcomeV2
}

// This plan describes one atomic write; it cannot confirm a database commit or account epoch.
export function planLocalPreferenceResult(
  input: unknown
): PreferenceResultPlan {
  const value = preferenceResultPlanInputSchema.parse(input)
  const { userId } = value
  const submission = validateLocalSyncResultInputV2(value.submission, userId)
  const { operation, result, senderId } = submission
  const command = operation.command
  if (result.kind !== "preference")
    throw new Error("Personal result application does not support this command")
  const primary = primaryResultKey(command)
  const personal: PersonalShadow[] = []
  const allKeys = new Set<string>()
  let itemCount = 0
  for (const shadow of value.shadows) {
    if (allKeys.has(shadow.entityKey))
      throw new Error("Duplicate stored shadow identity")
    allKeys.add(shadow.entityKey)
    if (shadow.kind === "item") {
      if (shadow.record.ownerId !== userId)
        throw new Error("Stored item shadow belongs to another account")
      itemCount++
    } else personal.push(shadow)
  }
  // Validate the entire queue and supported personal cache before choosing a branch.
  const initial = planRemotePreferenceProjection({
    userId,
    local: value.local,
    shadows: personal,
    entries: value.entries,
    incoming: null,
  })
  const entry = value.entries.find(
    (candidate) => candidate.operation.operationId === operation.operationId
  )
  if (!entry || JSON.stringify(entry.operation) !== JSON.stringify(operation))
    throw new Error("Submitted personal intention changed before its result")
  const previous =
    value.existingOutcome === null
      ? null
      : decodeLocalOperationOutcome(value.existingOutcome, userId)
  if (entry.state === "acknowledged") {
    if (
      previous?.kind !== "preference" ||
      JSON.stringify(previous.operation) !== JSON.stringify(operation) ||
      JSON.stringify(previous.result) !== JSON.stringify(result)
    )
      throw new Error(
        "Acknowledged personal result differs from its durable outcome"
      )
    return {
      status: "replayed",
      local: value.local,
      shadows: personal,
      entries: value.entries,
      outcome: previous,
    }
  }
  if (entry.state !== "sending" || entry.lease?.ownerId !== senderId)
    throw new Error("Sync sender no longer owns the personal operation lease")
  const current = result.outcome
  const keys = new Set([primary])
  if (current.status === "applied")
    for (const effect of current.effects.effects)
      keys.add(personalShadowEntityKey(effect))
  else if (current.status === "conflict")
    keys.add(personalShadowEntityKey(current.current))
  const local = new Map(
    value.local.map((snapshot) => [snapshot.entityKey, snapshot.record])
  )
  const bases = new Map(
    personal.map((shadow) => [shadow.entityKey, shadow.record])
  )
  const outcome = validateLocalPreferenceOutcomeV2(
    {
      version: 2,
      kind: "preference",
      key: `operation-outcome:${operation.operationId}`,
      operation,
      result,
      local: [...keys].map((entityKey) => ({
        entityKey,
        record: local.get(entityKey) ?? null,
      })),
      base: [...keys].map((entityKey) => ({
        entityKey,
        record: bases.get(entityKey) ?? null,
      })),
    },
    userId
  )
  const state =
    current.status === "applied"
      ? "acknowledged"
      : current.status === "conflict"
        ? "conflict"
        : current.status === "unsupported"
          ? "pending"
          : "rejected"
  const revisions = new Map(
    current.status === "applied"
      ? current.effects.effects.map((effect) => [
          personalShadowEntityKey(effect),
          effect.record.revision,
        ])
      : []
  )
  const entries = value.entries.map((candidate) => {
    if (candidate.operation.operationId === operation.operationId)
      return outboxEntrySchema.parse({ ...candidate, state, lease: null })
    const revision = revisions.get(candidate.entityKey)
    if (
      revision !== undefined &&
      candidate.state === "pending" &&
      candidate.attempts === 0 &&
      candidate.dependencies.includes(operation.operationId)
    )
      return outboxEntrySchema.parse({
        ...candidate,
        operation: { ...candidate.operation, baseRevision: revision },
      })
    return candidate
  })
  const observed = new Map(
    initial.shadows.map((shadow) => [shadow.entityKey, shadow])
  )
  if (current.status === "conflict") {
    const entityKey = personalShadowEntityKey(current.current)
    const old = observed.get(entityKey)
    if (
      old &&
      old.record.record.revision === current.current.record.revision &&
      JSON.stringify(old.record) !== JSON.stringify(current.current)
    )
      throw new Error("Remote personal records disagree at the same revision")
    if (!old || old.record.record.revision < current.current.record.revision)
      observed.set(entityKey, {
        version: 2,
        kind: "preference",
        entityKey,
        record: current.current,
      })
  }
  const projection = planRemotePreferenceProjection({
    userId,
    local: value.local,
    shadows: [...observed.values()],
    entries,
    incoming: current.status === "applied" ? current.effects : null,
  })
  if (itemCount + projection.shadows.length > 10000)
    throw new Error("Personal result exceeds the complete shadow limit")
  return {
    status: "applied",
    local: projection.local,
    shadows: projection.shadows,
    entries,
    outcome,
  }
}
