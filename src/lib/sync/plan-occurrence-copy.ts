import { applyPlanCommand } from "@/lib/calendar/plan-command"
import { validatePlanOccurrenceResolutionComparison } from "@/lib/sync/plan-occurrence-resolution"
import {
  planOccurrenceCopyRecordSchema,
  planOccurrenceCopyRequestSchema,
} from "@/schemas/plan-occurrence-copy"
import { planOccurrenceIncidentSnapshotSchema } from "@/schemas/plan-occurrence-resolution"
import { syncOperationSchema } from "@/schemas/sync"
import type { PlanOccurrenceCopyRecord } from "@/types/plan-occurrence-copy"

// This planner cannot acknowledge commands or authorize changes to the original series.
export function planOccurrenceCopy(
  input: unknown,
  currentInput: unknown
): PlanOccurrenceCopyRecord {
  const request = planOccurrenceCopyRequestSchema.parse(input),
    current = planOccurrenceIncidentSnapshotSchema.parse(currentInput)
  if (JSON.stringify(request.expected) !== JSON.stringify(current))
    throw new Error("Appearance copy comparison changed after review")
  const { value, remote, ids } = validatePlanOccurrenceResolutionComparison(
      current,
      request.userId
    ),
    local = value.local
  if (
    !local ||
    local.deletedAt ||
    local.cancelled ||
    (!remote.cancelled && !remote.deletedAt)
  )
    throw new Error(
      "Appearance copy requires a living local draft and known cancelled remote slot"
    )
  if (
    JSON.stringify(value.intentions[0]) !== JSON.stringify(value.entry) ||
    value.entry.attempts < 1
  )
    throw new Error(
      "Appearance copy requires the first preserved conflict in its chain"
    )
  const seen = new Set<string>()
  let previousSequence = 0
  let previousOperationId: string | null = null
  for (const entry of value.intentions) {
    if (
      entry.sequence <= previousSequence ||
      entry.dependencies.some((id) => !seen.has(id)) ||
      (previousOperationId !== null &&
        !entry.dependencies.includes(previousOperationId)) ||
      (seen.size > 0 && (entry.state !== "pending" || entry.attempts !== 0))
    )
      throw new Error(
        "Appearance copy requires an ordered isolated chain without external prerequisites"
      )
    previousSequence = entry.sequence
    previousOperationId = entry.operation.operationId
    seen.add(entry.operation.operationId)
  }
  const identities = [
    request.resolutionId,
    request.operationId,
    request.copyItemId,
  ]
  if (
    new Set(identities).size !== identities.length ||
    identities.some((id) => ids.has(id) || id === value.series.id)
  )
    throw new Error("Appearance copy requires new distinct identities")
  const replacement = syncOperationSchema.parse({
    operationId: request.operationId,
    protocolVersion: 1,
    baseRevision: 0,
    command: {
      type: "item.create",
      itemId: request.copyItemId,
      input: {
        kind: "plan",
        variant: value.series.variant,
        title: local.content?.title ?? value.series.title,
        description: local.content?.description ?? value.series.description,
        schedule: local.schedule,
        status: local.status,
        checklist: local.checklist,
        recurrence: null,
      },
    },
  })
  return planOccurrenceCopyRecordSchema.parse({
    ...request,
    key: `appearance-copy-resolution:${request.resolutionId}`,
    local: remote,
    copy: applyPlanCommand(
      null,
      replacement.command,
      request.userId,
      request.createdAt
    ),
    replacement,
    supersededOperationIds: value.intentions.map(
      (entry) => entry.operation.operationId
    ),
  })
}

export function validatePlanOccurrenceCopyRecord(
  input: unknown,
  actor: string
): PlanOccurrenceCopyRecord {
  const record = planOccurrenceCopyRecordSchema.parse(input)
  if (record.userId !== actor)
    throw new Error("Appearance copy decision belongs to another account")
  const request = planOccurrenceCopyRequestSchema.parse({
    reviewKind: record.reviewKind,
    choice: record.choice,
    userId: record.userId,
    resolutionId: record.resolutionId,
    operationId: record.operationId,
    copyItemId: record.copyItemId,
    createdAt: record.createdAt,
    expected: record.expected,
  })
  if (
    JSON.stringify(planOccurrenceCopy(request, record.expected)) !==
    JSON.stringify(record)
  )
    throw new Error("Appearance copy decision contradicts its exact evidence")
  return record
}
