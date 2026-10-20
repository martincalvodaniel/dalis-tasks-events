import { previewPlacementLatestMovement } from "@/lib/sync/placement-decision"
import { validateRecurringPlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import {
  recurringPlacementResolutionRecordSchema,
  recurringPlacementResolutionRequestSchema,
} from "@/schemas/recurring-placement-resolution"
import type { PlacementResolutionSnapshot } from "@/types/placement-resolution"
import type {
  RecurringPlacementResolutionRecord,
  RecurringPlacementResolutionRequest,
} from "@/types/recurring-placement-resolution"

function buildRecord(
  request: RecurringPlacementResolutionRequest
): RecurringPlacementResolutionRecord {
  const planned =
    request.choice === "retry_latest_move" && request.operationId
      ? previewPlacementLatestMovement(
          request.expected,
          request.operationId,
          request.createdAt
        )
      : { replacement: null, placements: request.expected.observed.placements }
  return recurringPlacementResolutionRecordSchema.parse({
    ...request,
    key: `placement-resolution:${request.resolutionId}`,
    ...planned,
    supersededOperationIds: request.expected.incident.intentions.map(
      (entry) => entry.operation.operationId
    ),
  })
}
function reviewedChoice(
  snapshot: PlacementResolutionSnapshot,
  choice: RecurringPlacementResolutionRequest["choice"]
) {
  // These known identities measure representation only and never reach a writer or remote executor.
  const id = snapshot.incident.entry.operation.operationId
  return buildRecord({
    reviewKind: "recurring_primary",
    userId: snapshot.incident.entry.userId,
    resolutionId: id,
    operationId: choice === "retry_latest_move" ? id : null,
    choice,
    createdAt: "2000-01-01T00:00:00.000Z",
    expected: snapshot,
  })
}
export function availableRecurringPlacementResolutionChoices(
  input: unknown,
  actor: string
): RecurringPlacementResolutionRequest["choice"][] {
  try {
    const snapshot = validateRecurringPlacementResolutionSnapshot(input, actor)
    return (["adopt_remote", "retry_latest_move"] as const).filter((choice) => {
      try {
        reviewedChoice(snapshot, choice)
        return true
      } catch {
        return false
      }
    })
  } catch {
    return []
  }
}
export function previewRecurringPlacementResolutionChoice(
  input: unknown,
  actor: string,
  choice: RecurringPlacementResolutionRequest["choice"]
) {
  return reviewedChoice(
    validateRecurringPlacementResolutionSnapshot(input, actor),
    choice
  ).placements
}
export function planRecurringPlacementIncidentResolution(
  input: unknown,
  currentInput: unknown
): RecurringPlacementResolutionRecord {
  const request = recurringPlacementResolutionRequestSchema.parse(input),
    current = validateRecurringPlacementResolutionSnapshot(
      currentInput,
      request.userId
    )
  if (JSON.stringify(request.expected) !== JSON.stringify(current))
    throw new Error("Recurring placement comparison changed after review")
  const identities = [request.resolutionId, request.operationId].filter(
    (id) => id !== null
  )
  if (
    new Set(identities).size !== identities.length ||
    [...current.incident.intentions, ...current.acknowledgedDependencies].some(
      (entry) => identities.includes(entry.operation.operationId)
    )
  )
    throw new Error(
      "Recurring placement decision identities must be new and distinct"
    )
  return buildRecord(request)
}
export function validateRecurringPlacementResolutionRecord(
  input: unknown,
  actor: string
): RecurringPlacementResolutionRecord {
  const record = recurringPlacementResolutionRecordSchema.parse(input)
  if (record.userId !== actor)
    throw new Error("Recurring placement decision belongs to another account")
  const request = {
    reviewKind: record.reviewKind,
    userId: record.userId,
    resolutionId: record.resolutionId,
    operationId: record.operationId,
    choice: record.choice,
    createdAt: record.createdAt,
    expected: record.expected,
  }
  if (
    JSON.stringify(
      planRecurringPlacementIncidentResolution(request, record.expected)
    ) !== JSON.stringify(record)
  )
    throw new Error("Recurring placement decision changed its exact evidence")
  return record
}
