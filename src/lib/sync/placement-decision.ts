import { planRemoteTaskPlacementOperation } from "@/lib/preferences/remote-task-placement-plan"
import { validatePlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import {
  placementResolutionRecordSchema,
  placementResolutionRequestSchema,
} from "@/schemas/placement-resolution"
import { syncOperationSchema } from "@/schemas/sync"
import type {
  PlacementResolutionRecord,
  PlacementResolutionRequest,
  PlacementResolutionSnapshot,
} from "@/types/placement-resolution"
import type { TaskPlacement } from "@/types/preferences"

function key(record: TaskPlacement) {
  return taskPlacementEntityKey(record.occurrenceId, record.scope, record.date)
}
function previewLatestMovement(
  snapshot: PlacementResolutionSnapshot,
  operationId: string,
  timestamp: string
) {
  const command = snapshot.incident.intentions.at(-1)?.operation.command
  if (command?.type !== "task.move")
    throw new Error("Placement retry requires its exact latest movement")
  const primary = snapshot.observed.placements.find(
    (record) => key(record) === snapshot.incident.entry.entityKey
  )
  if (!primary || primary.deletedAt)
    throw new Error(
      "Placement retry cannot restore an absent or deleted primary"
    )
  const replacement = syncOperationSchema.parse({
      operationId,
      protocolVersion: 1,
      baseRevision: primary.revision,
      command,
    }),
    planned = planRemoteTaskPlacementOperation(
      {
        userId: snapshot.incident.entry.userId,
        timestamp,
        operation: replacement,
        ...snapshot.observed,
      },
      true
    )
  if (
    planned.status !== "changes" ||
    !planned.effects.length ||
    planned.effects.some((effect) => effect.store !== "taskPlacements")
  )
    throw new Error("Placement retry has no exact supported effects")
  const records = new Map(
    snapshot.observed.placements.map((record) => [key(record), record])
  )
  for (const effect of planned.effects) {
    if (
      effect.store !== "taskPlacements" ||
      effect.record.scope !== command.scope ||
      effect.record.tagId !== command.tagId
    )
      throw new Error("Placement retry changes another domain or group")
    const identity = key(effect.record),
      old = records.get(identity)
    // Optimism keeps the observed revision; only a remote receipt can advance it.
    records.set(identity, { ...effect.record, revision: old?.revision ?? 0 })
  }
  return {
    replacement,
    placements: [...records.values()].toSorted((a, b) =>
      key(a).localeCompare(key(b))
    ),
  }
}
// Presentation only; the writer must recapture the catalog and prove prerequisite ACK outcomes.
export function availablePlacementResolutionChoices(
  input: unknown,
  actor: string
): PlacementResolutionRequest["choice"][] {
  try {
    const snapshot = validatePlacementResolutionSnapshot(input, actor)
    try {
      previewLatestMovement(
        snapshot,
        snapshot.incident.entry.operation.operationId,
        snapshot.incident.entry.createdAt
      )
      return ["adopt_remote", "retry_latest_move"]
    } catch {
      return ["adopt_remote"]
    }
  } catch {
    return []
  }
}
export function previewPlacementResolutionChoice(
  input: unknown,
  actor: string,
  choice: PlacementResolutionRequest["choice"]
) {
  const snapshot = validatePlacementResolutionSnapshot(input, actor)
  if (choice === "adopt_remote") return snapshot.observed.placements
  if (choice !== "retry_latest_move")
    throw new Error("Placement preview choice is unsupported")
  return previewLatestMovement(
    snapshot,
    snapshot.incident.entry.operation.operationId,
    snapshot.incident.entry.createdAt
  ).placements
}
export function planPlacementIncidentResolution(
  input: unknown,
  currentInput: unknown
): PlacementResolutionRecord {
  const request = placementResolutionRequestSchema.parse(input),
    current = validatePlacementResolutionSnapshot(currentInput, request.userId)
  if (JSON.stringify(request.expected) !== JSON.stringify(current))
    throw new Error("Placement comparison changed after review")
  const identities = [request.resolutionId, request.operationId].filter(
    (id) => id !== null
  )
  if (
    new Set(identities).size !== identities.length ||
    [...current.incident.intentions, ...current.acknowledgedDependencies].some(
      (entry) => identities.includes(entry.operation.operationId)
    )
  )
    throw new Error("Placement decision identities must be new and distinct")
  const planned =
    request.choice === "retry_latest_move" && request.operationId
      ? previewLatestMovement(current, request.operationId, request.createdAt)
      : { replacement: null, placements: current.observed.placements }
  return placementResolutionRecordSchema.parse({
    ...request,
    key: `placement-resolution:${request.resolutionId}`,
    ...planned,
    supersededOperationIds: current.incident.intentions.map(
      (entry) => entry.operation.operationId
    ),
  })
}
export function validatePlacementResolutionRecord(
  input: unknown,
  actor: string
): PlacementResolutionRecord {
  const record = placementResolutionRecordSchema.parse(input)
  if (record.userId !== actor)
    throw new Error("Placement decision belongs to another account")
  const planned = planPlacementIncidentResolution(
    {
      userId: record.userId,
      resolutionId: record.resolutionId,
      operationId: record.operationId,
      choice: record.choice,
      createdAt: record.createdAt,
      expected: record.expected,
    },
    record.expected
  )
  if (JSON.stringify(record) !== JSON.stringify(planned))
    throw new Error(
      "Stored placement decision contradicts its reviewed evidence"
    )
  return record
}
