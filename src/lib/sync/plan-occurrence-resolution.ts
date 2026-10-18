import { editablePlanOccurrence } from "@/lib/calendar/plan-occurrence-command"
import { validateLocalPlanOccurrenceOutcome } from "@/lib/sync/local-plan-occurrence-sync"
import {
  planOccurrenceIncidentSnapshotSchema,
  planOccurrenceResolutionRecordSchema,
  planOccurrenceResolutionRequestSchema,
} from "@/schemas/plan-occurrence-resolution"
import { remotePlanOccurrenceOperationSchema } from "@/schemas/remote-plan-occurrence-planning"
import type {
  PlanOccurrenceResolutionRecord,
  PlanOccurrenceResolutionRequest,
} from "@/types/plan-occurrence-resolution"

function validateComparison(input: unknown, actor: string) {
  const value = planOccurrenceIncidentSnapshotSchema.parse(input)
  const outcome = validateLocalPlanOccurrenceOutcome(value.outcome, actor)
  const command = outcome.operation.command,
    series = value.series,
    remote = value.remote
  if (
    value.entry.userId !== actor ||
    value.entry.entityKey !== `item:${command.itemId}` ||
    value.reason !== "conflict" ||
    value.entry.state !== "conflict" ||
    value.blockedByRelatedIntentions ||
    outcome.result.outcome.status !== "conflict"
  )
    throw new Error(
      "Appearance resolution requires its own complete conflict chain"
    )
  if (
    JSON.stringify(outcome.operation) !==
      JSON.stringify(value.entry.operation) ||
    JSON.stringify(outcome.local) !== JSON.stringify(value.localAtOutcome) ||
    JSON.stringify(outcome.base) !== JSON.stringify(value.shadowAtOutcome) ||
    JSON.stringify(outcome.series) !== JSON.stringify(value.seriesAtOutcome)
  )
    throw new Error("Appearance comparison does not match its frozen outcome")
  if (
    series.ownerId !== actor ||
    series.id !== command.itemId ||
    series.revision < 1 ||
    !series.recurrence ||
    series.deletedAt ||
    !remote ||
    remote.revision < 1
  )
    throw new Error(
      "Appearance adoption requires a committed remote and living recurring parent"
    )
  const remoteSeries = outcome.result.outcome.series
  if (
    remoteSeries.revision < 1 ||
    series.revision < remoteSeries.revision ||
    (series.revision === remoteSeries.revision &&
      JSON.stringify(series) !== JSON.stringify(remoteSeries))
  )
    throw new Error(
      "Appearance parent comparison regresses or contradicts observed remote evidence"
    )
  // Generate the original slot from the current parent without reviving a cancelled remote exception.
  editablePlanOccurrence(
    series,
    null,
    {
      type: "plan.set-occurrence-status",
      itemId: series.id,
      occurrenceId: command.occurrenceId,
      status: "not_started",
    },
    actor
  )
  for (const record of [
    value.local,
    value.localAtOutcome,
    value.shadowAtOutcome,
    remote,
    outcome.result.outcome.current,
  ])
    if (
      record &&
      (record.id !== command.occurrenceId || record.seriesId !== series.id)
    )
      throw new Error("Appearance comparison targets another series or slot")
  // Observed remote evidence bounds freshness, not the optimistic local revision or a presumed ancestor.
  for (const observed of [outcome.base, outcome.result.outcome.current])
    if (
      observed &&
      (observed.revision > remote.revision ||
        (observed.revision === remote.revision &&
          JSON.stringify(observed) !== JSON.stringify(remote)))
    )
      throw new Error(
        "Appearance comparison regresses or contradicts observed remote evidence"
      )
  const ids = new Set<string>(),
    sequences = new Set<number>()
  for (const entry of value.intentions) {
    const operation = remotePlanOccurrenceOperationSchema.parse(entry.operation)
    if (
      entry.userId !== actor ||
      entry.entityKey !== value.entry.entityKey ||
      operation.command.itemId !== series.id ||
      operation.command.occurrenceId !== command.occurrenceId ||
      entry.lease !== null ||
      ["acknowledged", "sending", "superseded"].includes(entry.state) ||
      (entry.state === "pending" && entry.attempts > 0) ||
      ids.has(operation.operationId) ||
      sequences.has(entry.sequence)
    )
      throw new Error(
        "Appearance chain contains another slot, family or uncertain intention"
      )
    ids.add(operation.operationId)
    sequences.add(entry.sequence)
  }
  if (
    !value.intentions.some(
      (entry) => JSON.stringify(entry) === JSON.stringify(value.entry)
    )
  )
    throw new Error("Appearance chain is missing its incident")
  return { value, remote, ids }
}
export function availablePlanOccurrenceResolutionChoices(
  input: unknown
): PlanOccurrenceResolutionRequest["choice"][] {
  try {
    const value = planOccurrenceIncidentSnapshotSchema.parse(input)
    validateComparison(value, value.entry.userId)
    return ["adopt_remote"]
  } catch {
    return []
  }
}
export function planOccurrenceIncidentResolution(
  input: unknown,
  currentInput: unknown
): PlanOccurrenceResolutionRecord {
  const request = planOccurrenceResolutionRequestSchema.parse(input),
    current = planOccurrenceIncidentSnapshotSchema.parse(currentInput)
  if (JSON.stringify(request.expected) !== JSON.stringify(current))
    throw new Error("Appearance comparison changed after it was opened")
  const { value, remote, ids } = validateComparison(current, request.userId)
  if (ids.has(request.resolutionId))
    throw new Error("Appearance decision requires a new identity")
  return planOccurrenceResolutionRecordSchema.parse({
    ...request,
    key: `appearance-resolution:${request.resolutionId}`,
    local: remote,
    replacement: null,
    supersededOperationIds: value.intentions.map(
      (entry) => entry.operation.operationId
    ),
  })
}
export function validatePlanOccurrenceResolutionRecord(
  input: unknown,
  actor: string
): PlanOccurrenceResolutionRecord {
  const record = planOccurrenceResolutionRecordSchema.parse(input)
  if (record.userId !== actor)
    throw new Error("Appearance decision belongs to another account")
  const request = {
    userId: record.userId,
    resolutionId: record.resolutionId,
    operationId: record.operationId,
    choice: record.choice,
    createdAt: record.createdAt,
    expected: record.expected,
  }
  if (
    JSON.stringify(
      planOccurrenceIncidentResolution(request, record.expected)
    ) !== JSON.stringify(record)
  )
    throw new Error(
      "Stored appearance decision contradicts its reviewed evidence"
    )
  return record
}
