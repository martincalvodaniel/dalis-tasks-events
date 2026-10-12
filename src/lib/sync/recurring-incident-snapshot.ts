import {
  projectSettingsSyncIncidentOverview,
  projectSyncIncidentOverview,
} from "@/lib/sync/incident-snapshot"
import { decodeRemoteRecurringShadow } from "@/lib/sync/local-plan-occurrence-sync"
import { decodeLocalRecurringOutcome } from "@/lib/sync/local-recurring-outcome"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import { planOccurrenceEntityKey } from "@/schemas/local-plan-occurrence-sync"
import { personalQueueDiagnosticsInputSchema } from "@/schemas/personal-queue-diagnostics"
import {
  recurringIncidentSnapshotInputSchema,
  recurringSyncIncidentOverviewInputSchema,
  settingsRecurringSyncIncidentOverviewInputSchema,
} from "@/schemas/recurring-sync-incident"
import type { PlanOccurrence } from "@/types/plan-occurrence"
import type {
  PlanOccurrenceSyncIncidentSnapshot,
  RecurringSyncIncidentOverview,
} from "@/types/recurring-sync-incident"
import type { SyncCommand } from "@/types/sync"

export function isPlanOccurrenceCommand(command: SyncCommand): boolean {
  return [
    "plan.set-occurrence-status",
    "plan.set-occurrence-checklist-entry",
    "plan.cancel-occurrence",
    "plan.update-occurrence",
  ].includes(command.type)
}

// Readonly comparison. Neither observed remote version is assumed to be an ancestor.
export function projectPlanOccurrenceSyncIncidents(
  input: unknown
): PlanOccurrenceSyncIncidentSnapshot[] {
  const value = recurringIncidentSnapshotInputSchema.parse(input)
  personalQueueDiagnosticsInputSchema.parse({
    userId: value.userId,
    items: value.items,
    entries: value.entries,
  })
  const items = new Map(value.items.map((item) => [item.id, item]))
  const occurrences = new Map(
    value.occurrences.map((record) => [record.id, record])
  )
  if (occurrences.size !== value.occurrences.length)
    throw new Error(
      "Recurring incident occurrences contain duplicate identities"
    )
  for (const record of value.occurrences)
    if (record.kind === "plan" && items.get(record.seriesId)?.kind !== "plan")
      throw new Error("Recurring incident occurrence parent is unavailable")
  const shadows = value.shadows.map((raw) =>
    decodeRemoteRecurringShadow(raw, value.userId)
  )
  if (
    new Set(shadows.map((shadow) => shadow.entityKey)).size !== shadows.length
  )
    throw new Error("Recurring incident shadow is duplicated")
  for (const shadow of shadows)
    if (
      shadow.kind === "plan-occurrence" &&
      items.get(shadow.record.seriesId)?.kind !== "plan"
    )
      throw new Error("Recurring incident shadow parent is unavailable")
  const entries = new Map(
    value.entries.map((entry) => [entry.operation.operationId, entry])
  )
  const outcomes = value.outcomes.map((raw) =>
    decodeLocalRecurringOutcome(raw, value.userId)
  )
  if (new Set(outcomes.map((outcome) => outcome.key)).size !== outcomes.length)
    throw new Error("Recurring incident outcome is duplicated")
  const byOperation = new Map(
    outcomes.map((outcome) => [outcome.operation.operationId, outcome])
  )
  for (const outcome of outcomes) {
    const entry = entries.get(outcome.operation.operationId),
      status = outcome.result.outcome.status
    if (
      !entry ||
      JSON.stringify(entry.operation) !== JSON.stringify(outcome.operation)
    )
      throw new Error(
        "Recurring incident outcome does not match its frozen intention"
      )
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
      throw new Error(
        "Recurring incident outcome does not match its preserved state"
      )
  }
  for (const entry of value.entries)
    if (
      (entry.state === "conflict" || entry.state === "rejected") &&
      !byOperation.has(entry.operation.operationId)
    )
      throw new Error("Recurring incident outcome is missing")
  return value.entries
    .filter(
      (entry) =>
        isPlanOccurrenceCommand(entry.operation.command) &&
        (entry.state === "conflict" || entry.state === "rejected")
    )
    .sort((a, b) => a.sequence - b.sequence)
    .map((entry) => {
      const outcome = byOperation.get(entry.operation.operationId)
      if (outcome?.kind !== "plan-occurrence")
        throw new Error("Appearance incident outcome has another family")
      const command = outcome.operation.command,
        series = items.get(command.itemId)
      if (series?.kind !== "plan")
        throw new Error("Appearance incident current parent is unavailable")
      const local = occurrences.get(command.occurrenceId)
      if (local && (local.kind !== "plan" || local.seriesId !== command.itemId))
        throw new Error(
          "Appearance incident local record has another family or parent"
        )
      const shadow = shadows.find(
        (record) =>
          record.entityKey === planOccurrenceEntityKey(command.occurrenceId)
      )
      if (shadow && shadow.kind !== "plan-occurrence")
        throw new Error("Appearance incident shadow has another family")
      const result = outcome.result.outcome
      if (result.status === "applied" || result.status === "unsupported")
        throw new Error("Appearance incident requires a terminal failure")
      const candidates = [
        outcome.base,
        result.status === "conflict" ? result.current : null,
        shadow?.record ?? null,
      ].filter((record): record is PlanOccurrence => record !== null)
      for (const record of candidates)
        if (record.revision < 1)
          throw new Error(
            "Appearance incident remote evidence is not committed"
          )
      for (const first of candidates)
        for (const second of candidates)
          if (
            first.revision === second.revision &&
            JSON.stringify(first) !== JSON.stringify(second)
          )
            throw new Error(
              "Appearance incident remote versions are contradictory"
            )
      const remote = candidates.reduce<PlanOccurrence | null>(
        (latest, record) =>
          !latest || record.revision > latest.revision ? record : latest,
        null
      )
      if (shadow && remote && shadow.record.revision < remote.revision)
        throw new Error(
          "Appearance incident current shadow regresses durable evidence"
        )
      const intentions = value.entries
        .filter(
          (pending) =>
            isUnresolvedOutboxEntry(pending) &&
            pending.entityKey === entry.entityKey
        )
        .sort((a, b) => a.sequence - b.sequence)
      const blockedByRelatedIntentions = intentions.some(
        (pending) =>
          !isPlanOccurrenceCommand(pending.operation.command) ||
          ("occurrenceId" in pending.operation.command &&
            pending.operation.command.occurrenceId !== command.occurrenceId) ||
          pending.dependencies.some((id) => {
            const dependency = entries.get(id)
            return (
              dependency?.state === "superseded" ||
              (dependency &&
                isUnresolvedOutboxEntry(dependency) &&
                dependency.entityKey !== entry.entityKey)
            )
          })
      )
      return {
        entry,
        reason: result.status,
        outcome,
        series,
        seriesAtOutcome: outcome.series,
        local: local ?? null,
        localAtOutcome: outcome.local,
        shadowAtOutcome: outcome.base,
        remote,
        intentions,
        blockedByRelatedIntentions,
      }
    })
}

export function projectRecurringSyncIncidentOverview(
  input: unknown
): RecurringSyncIncidentOverview[] {
  return projectRecurringIncidentOverview(input, false)
}

export function projectRecurringSettingsSyncIncidentOverview(
  input: unknown
): RecurringSyncIncidentOverview[] {
  return projectRecurringIncidentOverview(input, true)
}

function projectRecurringIncidentOverview(
  input: unknown,
  allowSettings: boolean
): RecurringSyncIncidentOverview[] {
  const complete = allowSettings
    ? settingsRecurringSyncIncidentOverviewInputSchema.parse(input)
    : { ...recurringSyncIncidentOverviewInputSchema.parse(input), settings: [] }
  for (const records of Object.values(complete))
    if (Array.isArray(records) && records.length > 10000)
      throw new Error("Recurring incident overview exceeds its record limit")
  const { occurrences, ...ordinary } = complete
  const {
    tags: _tags,
    itemViews: _itemViews,
    taskPlacements: _placements,
    settings: _settings,
    ...evidence
  } = ordinary
  const appearances = projectPlanOccurrenceSyncIncidents({
    ...evidence,
    occurrences,
  })
  return [
    ...(allowSettings
      ? projectSettingsSyncIncidentOverview(ordinary, true)
      : projectSyncIncidentOverview(
          {
            ...evidence,
            tags: ordinary.tags,
            itemViews: ordinary.itemViews,
            taskPlacements: ordinary.taskPlacements,
          },
          true
        )),
    ...appearances.map((incident) => ({
      kind: "plan-occurrence" as const,
      incident,
    })),
  ].sort((a, b) => a.incident.entry.sequence - b.incident.entry.sequence)
}
