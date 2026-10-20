import { orderPlacedTasks } from "@/lib/ordering/task-order"
import {
  compareRecurringMovementItems,
  recurringMovementCatalog,
} from "@/lib/preferences/recurring-movement-catalog"
import { placementDate, taskPlacementEntityKey } from "@/schemas/ordering"
import {
  placementGroupReviewInputSchema,
  placementGroupReviewSchema,
} from "@/schemas/placement-group-review"
import { remoteRecurringTaskPlacementPlanningInputSchema } from "@/schemas/recurring-task-placement-planning"
import type { PlacementGroupReview } from "@/types/placement-group-review"
import type { PlacementResolutionCatalog } from "@/types/placement-resolution"
import type { TaskPlacement } from "@/types/preferences"

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}
function key(record: TaskPlacement) {
  return taskPlacementEntityKey(record.occurrenceId, record.scope, record.date)
}
function orderedContext(catalog: PlacementResolutionCatalog) {
  return {
    items: catalog.items.toSorted((a, b) => a.id.localeCompare(b.id)),
    occurrences: catalog.occurrences.toSorted((a, b) =>
      a.id.localeCompare(b.id)
    ),
    tags: catalog.tags.toSorted((a, b) => a.id.localeCompare(b.id)),
    views: catalog.views.toSorted((a, b) => a.itemId.localeCompare(b.itemId)),
  }
}

// Observed catalogs describe known state. They do not prove current server completeness or authorize a write.
export function reviewPlacementGroup(input: unknown): PlacementGroupReview {
  return reviewGroup(input, "simple")
}
export function reviewRecurringPlacementGroup(
  input: unknown
): PlacementGroupReview {
  return reviewGroup(input, "appearance")
}
function reviewGroup(
  input: unknown,
  primaryKind: "simple" | "appearance"
): PlacementGroupReview {
  const value = placementGroupReviewInputSchema.parse(input),
    command = value.operation.command
  if (
    command.type !== "task.move" ||
    (primaryKind === "simple"
      ? command.occurrenceId !== null
      : command.occurrenceId === null)
  )
    throw new Error("Mixed group review requires a simple primary movement")
  for (const catalog of [value.local, value.observed])
    remoteRecurringTaskPlacementPlanningInputSchema.parse({
      userId: value.userId,
      timestamp: "2000-01-01T00:00:00.000Z",
      operation: value.operation,
      ...catalog,
    })
  if (!same(orderedContext(value.local), orderedContext(value.observed)))
    throw new Error(
      "Mixed group review cannot replace content, appearances, categories or assignments"
    )
  const parent = value.observed.items.find((item) => item.id === command.itemId)
  if (
    parent?.kind !== "plan" ||
    Boolean(parent.recurrence) !== (primaryKind === "appearance") ||
    parent.deletedAt ||
    (command.occurrenceId !== null &&
      !command.occurrenceId.startsWith(`${parent.id}:`))
  )
    throw new Error(
      "Mixed group review requires its living common simple primary"
    )
  const targetId = command.occurrenceId ?? parent.id
  const views = new Map(value.observed.views.map((view) => [view.itemId, view]))
  const activeTags = new Set(
    value.observed.tags.filter((tag) => !tag.deletedAt).map((tag) => tag.id)
  )
  if (command.tagId !== null && !activeTags.has(command.tagId))
    throw new Error("Mixed group destination category is unavailable")
  function effectiveTag(itemId: string) {
    const view = views.get(itemId)
    if (!view || view.deletedAt)
      throw new Error(
        "Mixed group requires each visible parent's known committed assignment"
      )
    return view.primaryTagId && activeTags.has(view.primaryTagId)
      ? view.primaryTagId
      : null
  }
  if (effectiveTag(parent.id) !== command.tagId)
    throw new Error("Mixed group review cannot change its primary category")
  const visible = recurringMovementCatalog(
    value.observed.items,
    value.observed.occurrences,
    value.userId,
    command
  )
  const group = visible.filter(
    (member) => effectiveTag(member.parent.id) === command.tagId
  )
  const byId = new Map(group.map((member) => [member.id, member]))
  if (!byId.has(targetId))
    throw new Error("Mixed group primary is outside its declared civil scope")
  const local = new Map(
      value.local.placements.map((record) => [key(record), record])
    ),
    observed = new Map(
      value.observed.placements.map((record) => [key(record), record])
    )
  if (
    local.size !== observed.size ||
    [...local.keys()].some((id) => !observed.has(id))
  )
    throw new Error(
      "Mixed group cannot infer missing or uncommitted placement identities"
    )
  const primaryKey = taskPlacementEntityKey(
      targetId,
      command.scope,
      command.date
    ),
    primary = local.get(primaryKey),
    remote = observed.get(primaryKey)
  if (
    !primary ||
    !remote ||
    primary.deletedAt ||
    primary.tagId !== command.tagId ||
    remote.tagId !== command.tagId
  )
    throw new Error("Mixed group requires its exact known primary placement")
  const date = placementDate(command.scope, command.date),
    changed: string[] = []
  for (const record of value.local.placements) {
    const other = observed.get(key(record))
    if (!other) throw new Error("Mixed group observation is missing")
    if (same(record, other)) continue
    if (
      record.scope !== command.scope ||
      other.scope !== command.scope ||
      record.date !== date ||
      other.date !== date ||
      record.tagId !== command.tagId ||
      other.tagId !== command.tagId ||
      record.deletedAt ||
      (other.deletedAt && record.occurrenceId !== targetId) ||
      record.revision > other.revision ||
      record.createdAt !== other.createdAt ||
      !byId.has(record.occurrenceId)
    )
      throw new Error(
        "Mixed group comparison changes an unknown, inactive or external placement"
      )
    changed.push(key(record))
  }
  const ordered = (placements: TaskPlacement[]) =>
    orderPlacedTasks(
      group,
      placements.filter(
        (record) => record.scope === command.scope && record.date === date
      ),
      command.tagId,
      compareRecurringMovementItems
    ).map((member) => member.id)
  return placementGroupReviewSchema.parse({
    userId: value.userId,
    primaryId: targetId,
    scope: command.scope,
    declaredDate: command.date,
    placementDate: date,
    tagId: command.tagId,
    includesRecurringPeers: group.some((member) =>
      Boolean(member.parent.recurrence)
    ),
    members: group
      .map((member) => ({
        id: member.id,
        parentId: member.parent.id,
        scheduledDate: member.scheduledDate,
        start: member.start,
        variant: member.variant,
        recurring: Boolean(member.parent.recurrence),
      }))
      .toSorted((a, b) => a.id.localeCompare(b.id)),
    localOrder: ordered(value.local.placements),
    observedOrder: ordered(value.observed.placements),
    changedPlacementKeys: changed.toSorted(),
  })
}
