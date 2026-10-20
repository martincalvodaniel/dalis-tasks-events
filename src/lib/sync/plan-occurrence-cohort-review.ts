import { planOccurrenceIncidentSnapshotSchema } from "@/schemas/plan-occurrence-resolution"
import { remotePlanOccurrenceOperationSchema } from "@/schemas/remote-plan-occurrence-planning"

// This only offers a fresh review, never a decision based on the incident DTO.
export function canReviewPlanOccurrenceCohort(
  input: unknown,
  actor: string
): boolean {
  const parsed = planOccurrenceIncidentSnapshotSchema.safeParse(input)
  if (!parsed.success) return false
  const value = parsed.data
  if (
    value.entry.userId !== actor ||
    value.series.ownerId !== actor ||
    value.reason !== "conflict" ||
    value.entry.state !== "conflict" ||
    value.entry.attempts < 1 ||
    value.entry.lease ||
    !value.series.recurrence ||
    value.series.deletedAt ||
    value.series.revision < 1 ||
    value.outcome.operation.operationId !== value.entry.operation.operationId ||
    !value.blockedByRelatedIntentions
  )
    return false
  const entries = value.intentions.toSorted((a, b) => a.sequence - b.sequence)
  if (entries[0]?.operation.operationId !== value.entry.operation.operationId)
    return false
  const slots = new Set<string>()
  for (const entry of entries) {
    const operation = remotePlanOccurrenceOperationSchema.safeParse(
      entry.operation
    )
    if (
      !operation.success ||
      operation.data.command.itemId !== value.series.id ||
      entry.userId !== actor ||
      entry.entityKey !== value.entry.entityKey
    )
      return false
    slots.add(operation.data.command.occurrenceId)
  }
  return slots.size > 1
}
