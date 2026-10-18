import { validateItemViewResolutionRecord } from "@/lib/sync/item-view-resolution"
import type { LocalRecurringOutcome } from "@/lib/sync/local-recurring-outcome"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import type { OutboxEntry } from "@/types/local-sync"

export function validateItemViewResolutionEvidence(
  input: unknown,
  actor: string,
  entries: Map<string, OutboxEntry>,
  outcomes: ReadonlyMap<string, LocalRecurringOutcome>
) {
  const record = validateItemViewResolutionRecord(input, actor)
  if (entries.has(record.resolutionId))
    throw new Error("Assignment decision identity collides with an operation")
  for (const reviewed of record.expected.incident.intentions) {
    if (
      JSON.stringify(entries.get(reviewed.operation.operationId)) !==
      JSON.stringify({ ...reviewed, state: "superseded", lease: null })
    )
      throw new Error(
        "Assignment decision changed its original intention evidence"
      )
  }
  const root = record.expected.incident
  if (
    JSON.stringify(outcomes.get(root.entry.operation.operationId)) !==
    JSON.stringify(root.outcome)
  )
    throw new Error("Assignment decision changed its original outcome evidence")
  for (const prerequisite of record.expected.acknowledgedDependencies) {
    const outcome = outcomes.get(prerequisite.operation.operationId)
    if (
      JSON.stringify(entries.get(prerequisite.operation.operationId)) !==
        JSON.stringify(prerequisite) ||
      outcome?.result.outcome.status !== "applied" ||
      JSON.stringify(outcome.operation) !==
        JSON.stringify(prerequisite.operation)
    )
      throw new Error("Assignment prerequisite has no matching durable ACK")
  }
  const ids = new Set(record.supersededOperationIds)
  for (const entry of entries.values())
    if (
      isUnresolvedOutboxEntry(entry) &&
      !ids.has(entry.operation.operationId) &&
      entry.dependencies.some((id) => ids.has(id))
    )
      throw new Error("Assignment decision has an unreviewed dependent")
  if (record.replacement) {
    const entry = entries.get(record.replacement.operationId)
    const maximum = Math.max(
      ...record.expected.incident.intentions.map((v) => v.sequence),
      ...record.expected.acknowledgedDependencies.map((v) => v.sequence)
    )
    if (
      !entry ||
      entry.userId !== actor ||
      entry.entityKey !== root.entry.entityKey ||
      entry.sequence <= maximum ||
      entry.createdAt !== record.createdAt ||
      entry.dependencies.length ||
      JSON.stringify(entry.operation) !== JSON.stringify(record.replacement)
    )
      throw new Error(
        "Assignment retry is missing its exact replacement evidence"
      )
  }
  return record
}
