import { planRemoteRecurringTaskPlacementOperation } from "@/lib/preferences/remote-recurring-task-placement-plan"
import { reviewCategoryPlacementGroups } from "@/lib/sync/category-placement-review"
import { validateCategoryPlacementResolutionSnapshot } from "@/lib/sync/placement-resolution"
import {
  categoryPlacementResolutionRecordSchema,
  categoryPlacementResolutionRequestSchema,
} from "@/schemas/category-placement-resolution"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import { syncOperationSchema } from "@/schemas/sync"
import type {
  CategoryPlacementResolutionRecord,
  CategoryPlacementResolutionRequest,
} from "@/types/category-placement-resolution"
import type { PlacementResolutionSnapshot } from "@/types/placement-resolution"

function previewCategoryLatestMovement(
  snapshot: PlacementResolutionSnapshot,
  operationId: string,
  createdAt: string
) {
  const review = reviewCategoryPlacementGroups({
      userId: snapshot.incident.entry.userId,
      operation: snapshot.incident.entry.operation,
      local: snapshot.local,
      observed: snapshot.observed,
    }),
    last = snapshot.incident.intentions.at(-1),
    primary = snapshot.observed.placements.find(
      (record) =>
        taskPlacementEntityKey(
          record.occurrenceId,
          record.scope,
          record.date
        ) === snapshot.incident.entry.entityKey
    )
  if (!last || !primary)
    throw new Error(
      "Category movement retry requires its exact last intention and known primary"
    )
  const replacement = syncOperationSchema.parse({
    ...last.operation,
    operationId,
    baseRevision: primary.revision,
  })
  const plan = planRemoteRecurringTaskPlacementOperation({
    userId: snapshot.incident.entry.userId,
    timestamp: createdAt,
    operation: replacement,
    ...snapshot.observed,
  })
  if (plan.status !== "changes")
    throw new Error(
      "Category movement retry is not justified by its reviewed context"
    )
  const positions = new Map(
      snapshot.observed.placements.map((record) => [
        taskPlacementEntityKey(record.occurrenceId, record.scope, record.date),
        record,
      ])
    ),
    members = new Set(review.members.map((member) => member.id)),
    knownView = snapshot.observed.views.find(
      (view) => view.itemId === review.parentId
    )
  let view = knownView,
    viewChanges = 0
  for (const effect of plan.effects) {
    if (effect.store === "taskPlacements") {
      const record = effect.record,
        key = taskPlacementEntityKey(
          record.occurrenceId,
          record.scope,
          record.date
        ),
        known = positions.get(key)
      if (
        !known ||
        !members.has(record.occurrenceId) ||
        record.scope !== review.scope ||
        record.date !== review.placementDate ||
        record.createdAt !== known.createdAt
      )
        throw new Error(
          "Category movement retry contains an unknown or external position"
        )
      positions.set(key, { ...record, revision: known.revision })
    } else if (
      effect.store === "itemViews" &&
      effect.record.itemId === review.parentId &&
      knownView
    ) {
      if (++viewChanges !== 1)
        throw new Error("Category movement retry repeats its parent assignment")
      view = { ...effect.record, revision: knownView.revision }
    } else throw new Error("Category movement retry changes another domain")
  }
  if (!view || viewChanges !== 1 || view.primaryTagId !== review.localTagId)
    throw new Error(
      "Category movement retry lost its explicit destination assignment"
    )
  return {
    replacement,
    view,
    placements: [...positions.values()].toSorted((a, b) =>
      taskPlacementEntityKey(a.occurrenceId, a.scope, a.date).localeCompare(
        taskPlacementEntityKey(b.occurrenceId, b.scope, b.date)
      )
    ),
  }
}

function buildRecord(
  request: CategoryPlacementResolutionRequest
): CategoryPlacementResolutionRecord {
  const command = request.expected.incident.entry.operation.command
  if (command.type !== "task.move")
    throw new Error("Category movement decision requires its reviewed parent")
  const knownView = request.expected.observed.views.find(
    (view) => view.itemId === command.itemId
  )
  if (!knownView)
    throw new Error(
      "Category movement decision is missing its committed parent view"
    )
  const planned =
    request.choice === "retry_latest_move" && request.operationId
      ? previewCategoryLatestMovement(
          request.expected,
          request.operationId,
          request.createdAt
        )
      : {
          replacement: null,
          placements: request.expected.observed.placements,
          view: knownView,
        }
  return categoryPlacementResolutionRecordSchema.parse({
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
  choice: CategoryPlacementResolutionRequest["choice"]
) {
  // These known identities measure representation only and never reach a writer or remote executor.
  const id = snapshot.incident.entry.operation.operationId
  return buildRecord({
    reviewKind: "category_movement",
    userId: snapshot.incident.entry.userId,
    resolutionId: id,
    operationId: choice === "retry_latest_move" ? id : null,
    choice,
    createdAt: "2000-01-01T00:00:00.000Z",
    expected: snapshot,
  })
}
export function availableCategoryPlacementResolutionChoices(
  input: unknown,
  actor: string
): CategoryPlacementResolutionRequest["choice"][] {
  try {
    const snapshot = validateCategoryPlacementResolutionSnapshot(input, actor)
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
export function previewCategoryPlacementResolutionChoice(
  input: unknown,
  actor: string,
  choice: CategoryPlacementResolutionRequest["choice"]
) {
  return reviewedChoice(
    validateCategoryPlacementResolutionSnapshot(input, actor),
    choice
  )
}
export function planCategoryPlacementIncidentResolution(
  input: unknown,
  currentInput: unknown
): CategoryPlacementResolutionRecord {
  const request = categoryPlacementResolutionRequestSchema.parse(input),
    current = validateCategoryPlacementResolutionSnapshot(
      currentInput,
      request.userId
    )
  if (JSON.stringify(request.expected) !== JSON.stringify(current))
    throw new Error("Category movement comparison changed after review")
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
      "Category movement decision identities must be new and distinct"
    )
  return buildRecord(request)
}
export function validateCategoryPlacementResolutionRecord(
  input: unknown,
  actor: string
): CategoryPlacementResolutionRecord {
  const record = categoryPlacementResolutionRecordSchema.parse(input)
  if (record.userId !== actor)
    throw new Error("Category movement decision belongs to another account")
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
      planCategoryPlacementIncidentResolution(request, record.expected)
    ) !== JSON.stringify(record)
  )
    throw new Error("Category movement decision changed its exact evidence")
  return record
}
