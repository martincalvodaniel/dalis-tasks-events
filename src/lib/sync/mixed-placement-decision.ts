import { previewPlacementLatestMovement } from "@/lib/sync/placement-decision"
import { validateMixedPlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import {
  mixedPlacementResolutionRecordSchema,
  mixedPlacementResolutionRequestSchema,
} from "@/schemas/mixed-placement-resolution"
import type {
  MixedPlacementResolutionRecord,
  MixedPlacementResolutionRequest,
} from "@/types/mixed-placement-resolution"
import type { PlacementResolutionSnapshot } from "@/types/placement-resolution"

function buildRecord(
  request: MixedPlacementResolutionRequest
): MixedPlacementResolutionRecord {
  const planned =
    request.choice === "retry_latest_move" && request.operationId
      ? previewPlacementLatestMovement(
          request.expected,
          request.operationId,
          request.createdAt
        )
      : { replacement: null, placements: request.expected.observed.placements }
  return mixedPlacementResolutionRecordSchema.parse({
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
  choice: MixedPlacementResolutionRequest["choice"]
) {
  // These known identities measure representation only and never reach a writer or remote executor.
  const id = snapshot.incident.entry.operation.operationId
  return buildRecord({
    reviewKind: "mixed_group",
    userId: snapshot.incident.entry.userId,
    resolutionId: id,
    operationId: choice === "retry_latest_move" ? id : null,
    choice,
    createdAt: "2000-01-01T00:00:00.000Z",
    expected: snapshot,
  })
}
export function availableMixedPlacementResolutionChoices(
  input: unknown,
  actor: string
): MixedPlacementResolutionRequest["choice"][] {
  try {
    const snapshot = validateMixedPlacementResolutionSnapshot(input, actor)
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
export function previewMixedPlacementResolutionChoice(
  input: unknown,
  actor: string,
  choice: MixedPlacementResolutionRequest["choice"]
) {
  return reviewedChoice(
    validateMixedPlacementResolutionSnapshot(input, actor),
    choice
  ).placements
}
export function planMixedPlacementIncidentResolution(
  input: unknown,
  currentInput: unknown
): MixedPlacementResolutionRecord {
  const request = mixedPlacementResolutionRequestSchema.parse(input),
    current = validateMixedPlacementResolutionSnapshot(
      currentInput,
      request.userId
    )
  if (JSON.stringify(request.expected) !== JSON.stringify(current))
    throw new Error("Mixed placement comparison changed after review")
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
      "Mixed placement decision identities must be new and distinct"
    )
  return buildRecord(request)
}
export function validateMixedPlacementResolutionRecord(
  input: unknown,
  actor: string
): MixedPlacementResolutionRecord {
  const record = mixedPlacementResolutionRecordSchema.parse(input)
  if (record.userId !== actor)
    throw new Error("Mixed placement decision belongs to another account")
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
      planMixedPlacementIncidentResolution(request, record.expected)
    ) !== JSON.stringify(record)
  )
    throw new Error("Mixed placement decision changed its exact evidence")
  return record
}
