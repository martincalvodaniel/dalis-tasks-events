import {
  decodeLocalRecurringOutcome,
  type LocalRecurringOutcome,
} from "@/lib/sync/local-recurring-outcome"
import { validatePlanOccurrenceCohortResolutionRecord } from "@/lib/sync/plan-occurrence-cohort-resolution"
import type { OutboxEntry } from "@/types/local-sync"

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function validatePlanOccurrenceCohortResolutionEvidence(
  input: unknown,
  actor: string,
  entries: ReadonlyMap<string, OutboxEntry>,
  outcomes: ReadonlyMap<string, LocalRecurringOutcome>
) {
  const record = validatePlanOccurrenceCohortResolutionRecord(input, actor)
  const expected = record.expected
  const reviewed = new Map(
    expected.source.entries.map((entry) => [entry.operation.operationId, entry])
  )
  const ids = new Set(record.supersededOperationIds)
  if (entries.has(record.resolutionId))
    throw new Error(
      "Appearance cohort decision identity collides with an operation"
    )
  for (const id of ids) {
    const original = reviewed.get(id)
    if (
      !original ||
      !same(entries.get(id), { ...original, state: "superseded", lease: null })
    )
      throw new Error(
        "Appearance cohort decision changed its original intention evidence"
      )
  }
  const prerequisiteIds = new Set(expected.prerequisiteOperationIds)
  for (const raw of expected.source.outcomes) {
    const outcome = decodeLocalRecurringOutcome(raw, actor)
    const id = outcome.operation.operationId
    if (
      !prerequisiteIds.has(id) &&
      !(
        outcome.kind === "plan-occurrence" &&
        outcome.operation.command.itemId === expected.source.series.id
      )
    )
      continue
    if (!same(outcomes.get(id), outcome))
      throw new Error(
        "Appearance cohort decision changed its cited outcome evidence"
      )
    if (!ids.has(id) && !same(entries.get(id), reviewed.get(id)))
      throw new Error(
        "Appearance cohort decision changed its historical evidence"
      )
  }
  for (const id of prerequisiteIds) {
    const outcome = outcomes.get(id)
    if (
      !same(entries.get(id), reviewed.get(id)) ||
      outcome?.result.outcome.status !== "applied" ||
      !same(outcome.operation, reviewed.get(id)?.operation)
    )
      throw new Error(
        "Appearance cohort prerequisite has no matching durable ACK"
      )
  }
  for (const entry of entries.values())
    if (
      !ids.has(entry.operation.operationId) &&
      entry.dependencies.some((id) => ids.has(id))
    )
      throw new Error(
        "Appearance cohort decision has an unreviewed external dependent"
      )
  const first = record.replacements[0]
    ? entries.get(record.replacements[0].operation.operationId)
    : null
  const maximum = expected.source.entries.reduce(
    (maximum, entry) => Math.max(maximum, entry.sequence),
    0
  )
  for (const [index, replacement] of record.replacements.entries()) {
    const entry = entries.get(replacement.operation.operationId)
    if (
      !first ||
      !entry ||
      first.sequence <= maximum ||
      entry.sequence !== first.sequence + index ||
      entry.userId !== actor ||
      entry.entityKey !== `item:${expected.source.series.id}` ||
      entry.createdAt !== record.createdAt ||
      !same(entry.operation, replacement.operation) ||
      !same(entry.dependencies, replacement.dependencies)
    )
      throw new Error(
        "Appearance cohort retry is missing its exact ordered replacement evidence"
      )
  }
  return record
}
