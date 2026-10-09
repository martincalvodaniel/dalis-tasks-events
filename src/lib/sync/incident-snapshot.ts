import { projectSyncIncident } from "@/lib/sync/incident-projection"
import { decodeLocalOperationOutcome } from "@/lib/sync/local-operation-outcome-v2"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import { remoteOperationKind } from "@/lib/sync/remote-push-v2"
import { decodeRemoteShadow } from "@/lib/sync/remote-shadow-v2"
import { preferenceEffectSchema } from "@/schemas/preference-effects"
import { personalShadowEntityKey } from "@/schemas/remote-shadow-v2"
import {
  syncIncidentOverviewInputSchema,
  syncIncidentSnapshotInputSchema,
} from "@/schemas/sync-incident"
import type { LocalPreferenceOutcomeV2 } from "@/types/local-operation-outcome-v2"
import type { OutboxEntry } from "@/types/local-sync"
import type { PersonalSnapshot } from "@/types/personal-snapshot"
import type { PreferenceEffect } from "@/types/preference-effects"
import type {
  PersonalSyncIncidentSnapshot,
  SyncIncidentOverview,
  SyncIncidentSnapshot,
} from "@/types/sync-incident"

function prepareIncidentEvidence(input: unknown) {
  const value = syncIncidentSnapshotInputSchema.parse(input)
  const shadows = value.shadows.map((shadow) =>
    decodeRemoteShadow(shadow, value.userId)
  )
  const outcomes = value.outcomes.map((outcome) =>
    decodeLocalOperationOutcome(outcome, value.userId)
  )
  const keys = new Set<string>()
  for (const shadow of shadows) {
    if (keys.has(shadow.entityKey))
      throw new Error("Incident shadow is duplicated")
    keys.add(shadow.entityKey)
  }
  keys.clear()
  const entries = new Map(
    value.entries.map((entry) => [entry.operation.operationId, entry])
  )
  for (const outcome of outcomes) {
    if (keys.has(outcome.key)) throw new Error("Incident outcome is duplicated")
    keys.add(outcome.key)
    const entry = entries.get(outcome.operation.operationId)
    if (
      !entry ||
      JSON.stringify(entry.operation) !== JSON.stringify(outcome.operation)
    )
      throw new Error("Incident outcome does not match its frozen intention")
    const status = outcome.result.outcome.status
    if (
      entry.state !== "superseded" &&
      ((status === "applied" && entry.state !== "acknowledged") ||
        (status === "conflict" && entry.state !== "conflict") ||
        (status === "unsupported" &&
          entry.state !== "pending" &&
          entry.state !== "sending") ||
        (!["applied", "conflict", "unsupported"].includes(status) &&
          entry.state !== "rejected"))
    )
      throw new Error("Incident outcome does not match its preserved state")
  }
  for (const entry of value.entries)
    if (
      (entry.state === "conflict" || entry.state === "rejected") &&
      !keys.has(`operation-outcome:${entry.operation.operationId}`)
    )
      throw new Error("Incident outcome is missing")
  return { ...value, shadows, outcomes }
}

function projectItemIncidents(
  value: ReturnType<typeof prepareIncidentEvidence>
): SyncIncidentSnapshot[] {
  const { userId, entries, items, outcomes } = value
  const shadows = value.shadows.filter((shadow) => shadow.kind === "item")
  const operationIds = new Set<string>()
  const sequences = new Set<number>()
  const intentions = new Map<string, OutboxEntry[]>()
  for (const entry of entries) {
    const id = entry.operation.operationId
    if (
      entry.userId !== userId ||
      operationIds.has(id) ||
      sequences.has(entry.sequence)
    )
      throw new Error("Incident queue contains foreign or duplicate operations")
    operationIds.add(id)
    sequences.add(entry.sequence)
    if (isUnresolvedOutboxEntry(entry)) {
      const group = intentions.get(entry.entityKey) ?? []
      group.push(entry)
      intentions.set(entry.entityKey, group)
    }
  }
  for (const group of intentions.values())
    group.sort((a, b) => a.sequence - b.sequence)
  const byId = new Map(
    entries.map((entry) => [entry.operation.operationId, entry])
  )
  const blockedEntities = new Set<string>()
  for (const entry of entries) {
    if (!isUnresolvedOutboxEntry(entry)) continue
    for (const id of entry.dependencies) {
      const dependency = byId.get(id)
      if (!dependency || dependency.state === "superseded")
        blockedEntities.add(entry.entityKey)
      else if (
        isUnresolvedOutboxEntry(dependency) &&
        dependency.entityKey !== entry.entityKey
      ) {
        blockedEntities.add(entry.entityKey)
        blockedEntities.add(dependency.entityKey)
      }
    }
  }
  const local = new Map<string, (typeof items)[number]>()
  for (const item of items) {
    if (item.ownerId !== userId || local.has(item.id))
      throw new Error("Incident items contain foreign or duplicate identities")
    local.set(item.id, item)
  }
  const remote = new Map<string, (typeof shadows)[number]["record"]>()
  for (const shadow of shadows) {
    if (shadow.record.ownerId !== userId || remote.has(shadow.entityKey))
      throw new Error(
        "Incident shadows contain foreign or duplicate identities"
      )
    remote.set(shadow.entityKey, shadow.record)
  }
  const evidence = new Map<string, (typeof outcomes)[number]>()
  for (const outcome of outcomes) {
    if (outcome.kind !== "item") continue
    if (evidence.has(outcome.key))
      throw new Error("Incident outcome is duplicated")
    evidence.set(outcome.key, outcome)
  }
  return entries
    .filter(
      (entry) =>
        remoteOperationKind(entry.operation.command) === "item" &&
        (entry.state === "conflict" || entry.state === "rejected")
    )
    .sort((a, b) => a.sequence - b.sequence)
    .map((entry) => {
      const command = entry.operation.command
      if (!("itemId" in command))
        throw new Error("Incident requires an item identity")
      return {
        ...projectSyncIncident({
          userId,
          entry,
          local: local.get(command.itemId) ?? null,
          remote: remote.get(entry.entityKey) ?? null,
          outcome: (() => {
            const outcome = evidence.get(
              `operation-outcome:${entry.operation.operationId}`
            )
            if (outcome?.kind !== "item")
              throw new Error("Item incident outcome is missing")
            return {
              key: outcome.key,
              operation: outcome.operation,
              result: outcome.result.outcome,
              local: outcome.local,
              base: outcome.base,
            }
          })(),
        }),
        intentions: intentions.get(entry.entityKey) ?? [],
        blockedByRelatedIntentions: blockedEntities.has(entry.entityKey),
      }
    })
}

export function projectSyncIncidentSnapshot(
  input: unknown
): SyncIncidentSnapshot[] {
  return projectItemIncidents(prepareIncidentEvidence(input))
}

function projectPersonalIncident(
  entry: OutboxEntry,
  outcome: LocalPreferenceOutcomeV2,
  current: Map<string, PersonalSnapshot[number]["record"]>,
  shadows: Map<string, PreferenceEffect>,
  intentions: OutboxEntry[],
  tagNames: Record<string, string>
): PersonalSyncIncidentSnapshot {
  const result = outcome.result.outcome
  if (
    result.status === "applied" ||
    result.status === "unsupported" ||
    (entry.state === "conflict") !== (result.status === "conflict")
  )
    throw new Error("Personal incident state does not match its durable result")
  const known = new Map<string, PreferenceEffect>()
  const learn = (key: string, record: PreferenceEffect) => {
    const previous = known.get(key)
    if (
      previous &&
      previous.record.revision === record.record.revision &&
      JSON.stringify(previous) !== JSON.stringify(record)
    )
      throw new Error("Personal incident remote versions are contradictory")
    if (!previous || record.record.revision > previous.record.revision)
      known.set(key, record)
  }
  for (const snapshot of outcome.base)
    if (snapshot.record)
      learn(snapshot.entityKey, preferenceEffectSchema.parse(snapshot.record))
  if (result.status === "conflict")
    learn(personalShadowEntityKey(result.current), result.current)
  for (const snapshot of outcome.local) {
    const shadow = shadows.get(snapshot.entityKey)
    if (!shadow) continue
    const preserved = known.get(snapshot.entityKey)
    if (preserved && shadow.record.revision < preserved.record.revision)
      throw new Error(
        "Personal incident current shadow cannot regress its durable evidence"
      )
    learn(snapshot.entityKey, shadow)
  }
  return {
    entry,
    reason: result.status,
    outcome,
    local: outcome.local.map(({ entityKey }) => ({
      entityKey,
      record: current.get(entityKey) ?? null,
    })),
    localAtOutcome: outcome.local,
    shadowAtOutcome: outcome.base,
    remote: outcome.local.map(({ entityKey }) => ({
      entityKey,
      record: known.get(entityKey) ?? null,
    })),
    intentions,
    tagNames,
  }
}

export function projectSyncIncidentOverview(
  input: unknown
): SyncIncidentOverview[] {
  const complete = syncIncidentOverviewInputSchema.parse(input)
  const { tags, itemViews, taskPlacements, ...evidenceInput } = complete
  const value = prepareIncidentEvidence(evidenceInput)
  const itemIncidents = projectItemIncidents(value)
  const current = new Map<string, PersonalSnapshot[number]["record"]>()
  for (const effect of [
    ...tags.map((record) => ({ store: "tags" as const, record })),
    ...itemViews.map((record) => ({ store: "itemViews" as const, record })),
    ...taskPlacements.map((record) => ({
      store: "taskPlacements" as const,
      record,
    })),
  ]) {
    const key = personalShadowEntityKey(effect)
    if (effect.record.userId !== value.userId || current.has(key))
      throw new Error(
        "Personal incident local records contain foreign or duplicate identities"
      )
    current.set(key, effect)
  }
  const shadows = new Map<string, PreferenceEffect>()
  for (const shadow of value.shadows)
    if (shadow.kind === "preference")
      shadows.set(shadow.entityKey, shadow.record)
  const outcomes = new Map(
    value.outcomes.map((outcome) => [outcome.operation.operationId, outcome])
  )
  const intentions = value.entries
    .filter(
      (entry) =>
        remoteOperationKind(entry.operation.command) === "preference" &&
        isUnresolvedOutboxEntry(entry)
    )
    .sort((a, b) => a.sequence - b.sequence)
  const incidents: SyncIncidentOverview[] = itemIncidents.map((incident) => ({
    kind: "item",
    incident,
  }))
  for (const entry of value.entries) {
    if (
      remoteOperationKind(entry.operation.command) !== "preference" ||
      (entry.state !== "conflict" && entry.state !== "rejected")
    )
      continue
    const outcome = outcomes.get(entry.operation.operationId)
    if (outcome?.kind !== "preference")
      throw new Error("Personal incident outcome is missing")
    incidents.push({
      kind: "preference",
      incident: projectPersonalIncident(
        entry,
        outcome,
        current,
        shadows,
        intentions,
        Object.fromEntries(tags.map((tag) => [tag.id, tag.name]))
      ),
    })
  }
  return incidents.sort(
    (a, b) => a.incident.entry.sequence - b.incident.entry.sequence
  )
}
