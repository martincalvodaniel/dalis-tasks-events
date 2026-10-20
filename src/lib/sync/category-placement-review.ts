import { orderPlacedTasks } from "@/lib/ordering/task-order"
import {
  compareRecurringMovementItems,
  recurringMovementCatalog,
} from "@/lib/preferences/recurring-movement-catalog"
import {
  categoryPlacementReviewInputSchema,
  categoryPlacementReviewSchema,
} from "@/schemas/category-placement-review"
import { placementDate, taskPlacementEntityKey } from "@/schemas/ordering"
import { remoteRecurringTaskPlacementPlanningInputSchema } from "@/schemas/recurring-task-placement-planning"
import type { CategoryPlacementReview } from "@/types/category-placement-review"
import type { TaskPlacement } from "@/types/preferences"

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}
function key(record: TaskPlacement) {
  return taskPlacementEntityKey(record.occurrenceId, record.scope, record.date)
}

// This compares complete known catalogs; it neither certifies server freshness nor authorizes a decision.
export function reviewCategoryPlacementGroups(
  input: unknown
): CategoryPlacementReview {
  const value = categoryPlacementReviewInputSchema.parse(input),
    { local, observed, userId, operation } = value,
    command = operation.command
  if (command.type !== "task.move")
    throw new Error("Category movement review requires an absolute movement")
  for (const catalog of [local, observed])
    remoteRecurringTaskPlacementPlanningInputSchema.parse({
      userId,
      operation,
      timestamp: "2000-01-01T00:00:00.000Z",
      ...catalog,
    })
  for (const field of ["items", "tags", "occurrences"] as const) {
    const sorted = (records: (typeof local)[typeof field]) =>
      records.toSorted((a, b) => a.id.localeCompare(b.id))
    if (!same(sorted(local[field]), sorted(observed[field])))
      throw new Error(
        "Category movement review cannot replace content, rules, appearances or categories"
      )
  }
  const parent = observed.items.find((item) => item.id === command.itemId),
    targetId = command.occurrenceId ?? command.itemId
  if (
    parent?.kind !== "plan" ||
    parent.deletedAt ||
    Boolean(parent.recurrence) !== (command.occurrenceId !== null)
  )
    throw new Error(
      "Category movement review requires its living common parent and exact slot"
    )
  const activeTags = new Set(
    observed.tags.filter((tag) => !tag.deletedAt).map((tag) => tag.id)
  )
  function requireTag(id: string | null) {
    if (id !== null && !activeTags.has(id))
      throw new Error(
        "Category movement review requires every referenced category to be active and known"
      )
    return id
  }
  const localViews = new Map(local.views.map((view) => [view.itemId, view])),
    remoteViews = new Map(observed.views.map((view) => [view.itemId, view]))
  if (
    localViews.size !== remoteViews.size ||
    [...localViews.keys()].some((id) => !remoteViews.has(id))
  )
    throw new Error("Category movement assignments are incomplete")
  for (const [id, view] of localViews) {
    const other = remoteViews.get(id)
    if (!other) throw new Error("Category movement assignment is missing")
    if (id === parent.id) {
      if (
        view.deletedAt ||
        other.deletedAt ||
        view.createdAt !== other.createdAt ||
        view.revision > other.revision
      )
        throw new Error(
          "Category movement parent assignment is deleted or inconsistent"
        )
    } else if (!same(view, other))
      throw new Error(
        "Category movement cannot replace another parent's assignment"
      )
  }
  function tag(itemId: string, views: typeof localViews) {
    const view = views.get(itemId)
    if (!view || view.deletedAt)
      throw new Error(
        "Category movement requires each visible parent's committed assignment"
      )
    return requireTag(view.primaryTagId)
  }
  const localTagId = tag(parent.id, localViews),
    observedTagId = tag(parent.id, remoteViews)
  if (localTagId !== command.tagId || localTagId === observedTagId)
    throw new Error(
      "Category movement requires its exact changed destination assignment"
    )
  const visible = recurringMovementCatalog(
    observed.items,
    observed.occurrences,
    userId,
    command
  )
  if (
    !visible.some(
      (member) => member.id === targetId && member.parent.id === parent.id
    )
  )
    throw new Error(
      "Category movement primary is outside its declared civil scope"
    )
  const groupTags = [observedTagId, localTagId],
    localTags = new Map<string, string | null>(),
    remoteTags = new Map<string, string | null>()
  for (const member of visible) {
    localTags.set(member.parent.id, tag(member.parent.id, localViews))
    remoteTags.set(member.parent.id, tag(member.parent.id, remoteViews))
  }
  const members = visible.filter(
      (member) =>
        groupTags.includes(localTags.get(member.parent.id) ?? null) ||
        groupTags.includes(remoteTags.get(member.parent.id) ?? null)
    ),
    byId = new Map(members.map((member) => [member.id, member]))
  const localPositions = new Map(
      local.placements.map((record) => [key(record), record])
    ),
    remotePositions = new Map(
      observed.placements.map((record) => [key(record), record])
    )
  if (
    localPositions.size !== remotePositions.size ||
    [...localPositions.keys()].some((id) => !remotePositions.has(id))
  )
    throw new Error(
      "Category movement cannot infer missing or uncommitted positions"
    )
  const primaryKey = taskPlacementEntityKey(
      targetId,
      command.scope,
      command.date
    ),
    primary = localPositions.get(primaryKey),
    remote = remotePositions.get(primaryKey),
    date = placementDate(command.scope, command.date)
  if (!primary || !remote || primary.deletedAt || primary.tagId !== localTagId)
    throw new Error(
      "Category movement primary position is not known in both states"
    )
  requireTag(primary.tagId)
  requireTag(remote.tagId)
  const changed: string[] = []
  for (const record of local.placements) {
    const other = remotePositions.get(key(record))
    if (!other)
      throw new Error("Category movement position observation is missing")
    if (same(record, other)) continue
    const member = byId.get(record.occurrenceId)
    if (
      !member ||
      record.scope !== command.scope ||
      other.scope !== command.scope ||
      record.date !== date ||
      other.date !== date ||
      record.deletedAt ||
      (other.deletedAt && record.occurrenceId !== targetId) ||
      record.revision > other.revision ||
      record.createdAt !== other.createdAt
    )
      throw new Error(
        "Category movement changes an external, deleted or uncertain position"
      )
    if (member.parent.id === parent.id) {
      requireTag(other.tagId)
      if (record.tagId !== localTagId)
        throw new Error(
          "Category movement sibling contradicts its parent destination"
        )
    } else if (
      record.tagId !== other.tagId ||
      record.tagId !== localTags.get(member.parent.id) ||
      other.tagId !== remoteTags.get(member.parent.id)
    )
      throw new Error(
        "Category movement peer position contradicts its own group"
      )
    changed.push(key(record))
  }
  const scope = command.scope
  function ordered(
    tagId: string | null,
    views: typeof localTags,
    placements: TaskPlacement[]
  ) {
    return orderPlacedTasks(
      members.filter((member) => views.get(member.parent.id) === tagId),
      placements.filter(
        (record) => record.scope === scope && record.date === date
      ),
      tagId,
      compareRecurringMovementItems
    ).map((member) => member.id)
  }
  return categoryPlacementReviewSchema.parse({
    userId,
    primaryId: targetId,
    parentId: parent.id,
    scope: command.scope,
    declaredDate: command.date,
    placementDate: date,
    assignmentScope: "parent_all_dates",
    localTagId,
    observedTagId,
    localPositionTagId: primary.tagId,
    observedPositionTagId: remote.tagId,
    includesRecurringPeers: members.some((member) =>
      Boolean(member.parent.recurrence)
    ),
    parentVisibleIds: members
      .filter((member) => member.parent.id === parent.id)
      .map((member) => member.id)
      .toSorted(),
    members: members
      .map((member) => ({
        id: member.id,
        parentId: member.parent.id,
        scheduledDate: member.scheduledDate,
        start: member.start,
        variant: member.variant,
        recurring: Boolean(member.parent.recurrence),
      }))
      .toSorted((a, b) => a.id.localeCompare(b.id)),
    groups: groupTags.map((tagId) => ({
      tagId,
      localOrder: ordered(tagId, localTags, local.placements),
      observedOrder: ordered(tagId, remoteTags, observed.placements),
    })),
    changedPlacementKeys: changed.toSorted(),
  })
}
