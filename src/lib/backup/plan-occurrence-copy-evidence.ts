import type { LocalRecurringOutcome } from "@/lib/sync/local-recurring-outcome"
import { validatePlanOccurrenceCopyRecord } from "@/lib/sync/plan-occurrence-copy"
import type { LocalRecurringBackup } from "@/types/local-backup"
import type { OutboxEntry } from "@/types/local-sync"

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

// A self-consistent captured decision is not evidence that its original operations were preserved.
export function validatePlanOccurrenceCopyEvidence(
  input: unknown,
  actor: string,
  entries: ReadonlyMap<string, OutboxEntry>,
  outcomes: ReadonlyMap<string, LocalRecurringOutcome>,
  items: ReadonlyMap<string, LocalRecurringBackup["stores"]["items"][number]>,
  occurrences: ReadonlyMap<
    string,
    LocalRecurringBackup["stores"]["occurrences"][number]
  >
) {
  const record = validatePlanOccurrenceCopyRecord(input, actor),
    expected = record.expected,
    copy = items.get(record.copyItemId),
    parent = items.get(expected.series.id),
    original = occurrences.get(record.local.id)
  if (
    copy?.kind !== "plan" ||
    parent?.kind !== "plan" ||
    original?.kind !== "plan" ||
    original.seriesId !== parent.id
  )
    throw new Error(
      "Backup appearance copy is missing its retained plan, parent or original slot"
    )
  if (entries.has(record.resolutionId) || entries.has(record.copyItemId))
    throw new Error(
      "Backup appearance copy identity collides with operation history"
    )
  const ids = new Set(record.supersededOperationIds)
  for (const reviewed of expected.intentions) {
    const id = reviewed.operation.operationId
    if (
      !same(entries.get(id), { ...reviewed, state: "superseded", lease: null })
    )
      throw new Error(
        "Backup appearance copy changed its original intention evidence"
      )
    if (id !== expected.entry.operation.operationId && outcomes.has(id))
      throw new Error(
        "Backup appearance copy has unexpected outcome evidence for an unattempted intention"
      )
  }
  if (
    !same(outcomes.get(expected.entry.operation.operationId), expected.outcome)
  )
    throw new Error(
      "Backup appearance copy changed its frozen outcome evidence"
    )
  const replacement = entries.get(record.operationId),
    maximum = expected.intentions.reduce(
      (maximum, entry) => Math.max(maximum, entry.sequence),
      0
    )
  if (
    !replacement ||
    replacement.userId !== actor ||
    replacement.entityKey !== `item:${record.copyItemId}` ||
    replacement.sequence <= maximum ||
    replacement.createdAt !== record.createdAt ||
    replacement.dependencies.length !== 0 ||
    !same(replacement.operation, record.replacement)
  )
    throw new Error(
      "Backup appearance copy is missing its exact replacement evidence"
    )
  for (const entry of entries.values()) {
    if (
      !ids.has(entry.operation.operationId) &&
      entry.dependencies.some((id) => ids.has(id))
    )
      throw new Error(
        "Backup appearance copy has an unreviewed external dependent"
      )
    const command = entry.operation.command
    if (
      "itemId" in command &&
      command.itemId === record.copyItemId &&
      entry.operation.operationId !== record.operationId &&
      (entry.sequence < replacement.sequence || command.type === "item.create")
    )
      throw new Error(
        "Backup appearance copy identity was already used by another intention"
      )
  }
  return record
}
