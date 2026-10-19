import { decodeRemoteRecurringShadow } from "@/lib/sync/local-plan-occurrence-sync"
import { decodeLocalRecurringOutcome } from "@/lib/sync/local-recurring-outcome"
import { readPlanOccurrenceRecoveryCohort } from "@/lib/sync/plan-occurrence-cohort"
import {
  planOccurrenceCohortComparisonInputSchema,
  planOccurrenceCohortComparisonSchema,
} from "@/schemas/plan-occurrence-cohort-comparison"
import type { Plan } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"
import type { PlanOccurrenceCohortComparison } from "@/types/plan-occurrence-cohort-comparison"

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

// This captures observed evidence only. A future writer must reread the source in its own transaction.
export function capturePlanOccurrenceCohortComparison(
  input: unknown
): PlanOccurrenceCohortComparison {
  const source = planOccurrenceCohortComparisonInputSchema.parse(input)
  const cohort = readPlanOccurrenceRecoveryCohort({
    userId: source.userId,
    operationId: source.operationId,
    series: source.series,
    entries: source.entries,
  })
  const entries = new Map(
    source.entries.map((entry) => [entry.operation.operationId, entry])
  )
  const outcomes = source.outcomes.map((raw) =>
    decodeLocalRecurringOutcome(raw, source.userId)
  )
  const byOperation = new Map(
    outcomes.map((outcome) => [outcome.operation.operationId, outcome])
  )
  const locals = new Map(
    source.occurrences.map((record) => [record.id, record])
  )
  const shadows = source.shadows.map((raw) =>
    decodeRemoteRecurringShadow(raw, source.userId)
  )
  const byShadow = new Map(shadows.map((shadow) => [shadow.entityKey, shadow]))
  if (
    byOperation.size !== outcomes.length ||
    locals.size !== source.occurrences.length ||
    byShadow.size !== shadows.length
  )
    throw new Error("Appearance cohort catalogs contain duplicate evidence")
  for (const outcome of outcomes) {
    const entry = entries.get(outcome.operation.operationId),
      status = outcome.result.outcome.status
    if (!entry || !same(entry.operation, outcome.operation))
      throw new Error(
        "Appearance cohort outcome differs from its preserved intention"
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
        "Appearance cohort outcome contradicts its preserved state"
      )
  }
  const root = byOperation.get(cohort.root.operation.operationId)
  if (
    root?.kind !== "plan-occurrence" ||
    root.result.outcome.status !== "conflict"
  )
    throw new Error(
      "Appearance cohort requires its exact frozen conflict outcome"
    )
  for (const entry of cohort.acknowledgedDependencies) {
    const outcome = byOperation.get(entry.operation.operationId)
    if (
      outcome?.result.outcome.status !== "applied" ||
      !same(outcome.operation, entry.operation)
    )
      throw new Error(
        "Appearance cohort prerequisite lacks a matching applied outcome"
      )
  }
  function requireParent(record: Plan) {
    if (
      record.ownerId !== source.userId ||
      record.id !== source.series.id ||
      !record.recurrence ||
      record.deletedAt ||
      record.revision < 1 ||
      record.revision > source.series.revision ||
      (record.revision === source.series.revision &&
        !same(record, source.series))
    )
      throw new Error(
        "Appearance cohort parent regresses or contradicts committed evidence"
      )
  }
  const observed = new Map<string, PlanOccurrence[]>()
  for (const slot of cohort.slots) observed.set(slot.occurrenceId, [])
  function observe(record: PlanOccurrence | null) {
    if (!record || !observed.has(record.id)) return
    if (record.seriesId !== source.series.id || record.revision < 1)
      throw new Error(
        "Appearance cohort remote evidence has an invalid identity or revision"
      )
    observed.get(record.id)?.push(record)
  }
  for (const outcome of outcomes) {
    if (
      outcome.kind !== "plan-occurrence" ||
      outcome.operation.command.itemId !== source.series.id
    )
      continue
    if (outcome.series) requireParent(outcome.series)
    const result = outcome.result.outcome
    if (result.status === "conflict") {
      requireParent(result.series)
      observe(result.current)
    } else if (result.status === "applied") {
      if (result.seriesRevision > source.series.revision)
        throw new Error(
          "Appearance cohort parent predates an applied appearance"
        )
      observe(result.occurrence)
    }
    observe(outcome.base)
  }
  for (const shadow of shadows) {
    if (shadow.kind === "item" && shadow.record.id === source.series.id) {
      if (shadow.record.kind !== "plan")
        throw new Error("Appearance cohort parent shadow has another family")
      requireParent(shadow.record)
    }
    if (shadow.kind === "plan-occurrence" && observed.has(shadow.record.id)) {
      if (shadow.seriesRevision > source.series.revision)
        throw new Error(
          "Appearance cohort parent predates an observed appearance"
        )
      observe(shadow.record)
    }
  }
  const slots = cohort.slots.map((slot) => {
    const local = locals.get(slot.occurrenceId) ?? null
    if (local && local.seriesId !== source.series.id)
      throw new Error("Appearance cohort local snapshot has another parent")
    let remote: PlanOccurrence | null = null
    const revisions = new Map<number, string>()
    for (const record of observed.get(slot.occurrenceId) ?? []) {
      const encoded = JSON.stringify(record),
        previous = revisions.get(record.revision)
      if (previous !== undefined && previous !== encoded)
        throw new Error(
          "Appearance cohort remote versions contradict each other"
        )
      revisions.set(record.revision, encoded)
      if (!remote || record.revision > remote.revision) remote = record
    }
    if (!remote)
      throw new Error(
        "Appearance cohort slot has no known committed remote snapshot"
      )
    const shadow = byShadow.get(`plan-occurrence:${slot.occurrenceId}`)
    if (
      shadow?.kind === "plan-occurrence" &&
      shadow.record.revision < remote.revision
    )
      throw new Error(
        "Appearance cohort current shadow regresses durable evidence"
      )
    return {
      occurrenceId: slot.occurrenceId,
      operationIds: slot.intentions.map((entry) => entry.operation.operationId),
      local,
      remote,
    }
  })
  return planOccurrenceCohortComparisonSchema.parse({
    source,
    operationIds: cohort.intentions.map((entry) => entry.operation.operationId),
    prerequisiteOperationIds: cohort.acknowledgedDependencies.map(
      (entry) => entry.operation.operationId
    ),
    slots,
  })
}

export function validatePlanOccurrenceCohortComparison(
  input: unknown,
  actor: string
): PlanOccurrenceCohortComparison {
  const value = planOccurrenceCohortComparisonSchema.parse(input)
  if (value.source.userId !== actor)
    throw new Error("Appearance cohort comparison belongs to another account")
  if (!same(capturePlanOccurrenceCohortComparison(value.source), value))
    throw new Error(
      "Appearance cohort comparison contradicts its reviewed source"
    )
  return value
}
