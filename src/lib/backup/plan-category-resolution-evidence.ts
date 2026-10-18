import type { LocalRecurringOutcome } from "@/lib/sync/local-recurring-outcome"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import { validatePlanCategoryResolutionRecord } from "@/lib/sync/plan-category-resolution"
import type { OutboxEntry } from "@/types/local-sync"

// Portable evidence must match durable history, not just a self-consistent snapshot.
export function validatePlanCategoryResolutionEvidence(
  input: unknown,
  actor: string,
  entries: Map<string, OutboxEntry>,
  outcomes: ReadonlyMap<string, LocalRecurringOutcome>
) {
  const record = validatePlanCategoryResolutionRecord(input, actor)
  if (entries.has(record.resolutionId))
    throw new Error("Backup joint decision identity collides with an operation")
  const originals = [
    ...record.expected.incident.intentions,
    ...record.expected.viewIntentions,
  ]
  const ids = new Set(record.supersededOperationIds)
  for (const reviewed of originals) {
    const current = entries.get(reviewed.operation.operationId)
    if (
      JSON.stringify(current) !==
      JSON.stringify({ ...reviewed, state: "superseded", lease: null })
    )
      throw new Error(
        "Backup joint decision changed its original intention evidence"
      )
  }
  const root = record.expected.incident
  const outcome = outcomes.get(root.entry.operation.operationId)
  if (
    outcome?.kind !== "item" ||
    JSON.stringify(outcome.local) !== JSON.stringify(root.localAtOutcome) ||
    JSON.stringify(outcome.base) !== JSON.stringify(root.shadowAtOutcome)
  )
    throw new Error(
      "Backup joint decision changed its original outcome evidence"
    )
  for (const prerequisite of record.expected.acknowledgedDependencies) {
    const current = entries.get(prerequisite.operation.operationId)
    const confirmed = outcomes.get(prerequisite.operation.operationId)
    if (
      JSON.stringify(current) !== JSON.stringify(prerequisite) ||
      confirmed?.result.outcome.status !== "applied" ||
      JSON.stringify(confirmed.operation) !==
        JSON.stringify(prerequisite.operation)
    )
      throw new Error("Backup joint prerequisite has no matching durable ACK")
  }
  for (const entry of entries.values())
    if (
      isUnresolvedOutboxEntry(entry) &&
      !ids.has(entry.operation.operationId) &&
      entry.dependencies.some((id) => ids.has(id))
    )
      throw new Error(
        "Backup joint decision has an unreviewed external dependent"
      )
  if (record.replacement && record.viewReplacement) {
    const replacements = [record.replacement, record.viewReplacement]
    const first = entries.get(record.replacement.operationId)
    const reviewedMaximum = Math.max(
      ...originals.map((entry) => entry.sequence),
      ...record.expected.acknowledgedDependencies.map((entry) => entry.sequence)
    )
    for (let index = 0; index < replacements.length; index++) {
      const operation = replacements[index],
        entry = entries.get(operation.operationId)
      if (
        !first ||
        !entry ||
        entry.userId !== actor ||
        first.sequence <= reviewedMaximum ||
        entry.sequence !== first.sequence + index ||
        entry.entityKey !==
          (index
            ? `item-view:${record.local.id}`
            : `item:${record.local.id}`) ||
        entry.createdAt !== record.createdAt ||
        JSON.stringify(entry.operation) !== JSON.stringify(operation) ||
        JSON.stringify(entry.dependencies) !==
          JSON.stringify(index ? [record.replacement.operationId] : [])
      )
        throw new Error(
          "Backup joint retry is missing its exact ordered replacement evidence"
        )
    }
  }
  return record
}
