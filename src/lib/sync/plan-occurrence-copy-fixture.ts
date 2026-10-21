import { planOccurrenceCohortFixture } from "@/lib/sync/plan-occurrence-cohort-fixture"
import { projectPlanOccurrenceSyncIncidents } from "@/lib/sync/recurring-incident-snapshot"
import { planOccurrenceCopyRequestSchema } from "@/schemas/plan-occurrence-copy"
import type { Plan } from "@/types/plan-item"

export function planOccurrenceCopyFixture(
  variant: Plan["variant"] = "task",
  actor = "appearance-copy-owner"
) {
  const source = planOccurrenceCohortFixture(actor),
    outcome = source.outcomes[0],
    result = outcome.result.outcome
  if (result.status !== "conflict" || !result.current)
    throw new Error("Copy fixture requires a conflict")
  for (const series of [source.series, outcome.series, result.series]) {
    if (!series) throw new Error("Copy fixture parent is missing")
    series.variant = variant
    series.description = "Inherited description"
  }
  result.current.cancelled = true
  source.shadows[0].record.cancelled = true
  const root = source.entries[0],
    child = source.entries[2]
  child.dependencies = [root.operation.operationId]
  const entries = [root, child],
    input = {
      userId: source.userId,
      items: [source.series],
      occurrences: source.occurrences,
      entries,
      shadows: source.shadows,
      outcomes: source.outcomes,
    },
    snapshot = projectPlanOccurrenceSyncIncidents(input)[0]
  return {
    ...source,
    entries,
    input,
    snapshot,
    request: planOccurrenceCopyRequestSchema.parse({
      reviewKind: "occurrence_copy",
      choice: "copy_local",
      userId: source.userId,
      resolutionId: crypto.randomUUID(),
      operationId: crypto.randomUUID(),
      copyItemId: crypto.randomUUID(),
      createdAt: "2026-10-21T07:00:00.000Z",
      expected: snapshot,
    }),
  }
}
