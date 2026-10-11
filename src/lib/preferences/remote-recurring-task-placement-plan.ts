import { orderPlacedTasks } from "@/lib/ordering/task-order"
import { applyItemViewCommand } from "@/lib/preferences/preference-command"
import {
  compareRecurringMovementItems,
  recurringMovementCatalog,
} from "@/lib/preferences/recurring-movement-catalog"
import { planTaskPlacements } from "@/lib/preferences/task-placement-command"
import { placementDate } from "@/schemas/ordering"
import { remotePreferenceEffectsSchema } from "@/schemas/preference-effects"
import { revisionSchema } from "@/schemas/primitives"
import {
  recurringTaskPlacementPlanningInputSchema,
  remoteRecurringTaskPlacementPlanningInputSchema,
} from "@/schemas/recurring-task-placement-planning"
import type { PreferenceEffect } from "@/types/preference-effects"
import type { RemoteTaskPlacementPlan } from "@/types/remote-task-placement-planning"

// Prepared scope only. A position's CAS is independent of its parent and appearance revisions.
export function planRemoteRecurringTaskPlacementOperation(
  input: unknown,
  localSnapshot = false
): RemoteTaskPlacementPlan {
  const {
    userId,
    timestamp,
    operation,
    items,
    occurrences,
    tags,
    views,
    placements,
  } = (
    localSnapshot
      ? recurringTaskPlacementPlanningInputSchema
      : remoteRecurringTaskPlacementPlanningInputSchema
  ).parse(input)
  const command = operation.command
  if (command.type !== "task.move") return { status: "unsupported" }
  const parent = items.find((item) => item.id === command.itemId)
  if (!parent || parent.deletedAt) return { status: "unavailable" }
  if (parent.kind !== "task" && parent.kind !== "plan")
    return { status: "unsupported" }
  if (
    parent.kind === "task" &&
    (parent.recurrence || command.occurrenceId !== null)
  )
    return { status: "unsupported" }
  if (Boolean(parent.recurrence) !== (command.occurrenceId !== null))
    return { status: "unsupported" }
  if (
    command.occurrenceId !== null &&
    !command.occurrenceId.startsWith(`${parent.id}:`)
  )
    return { status: "invalid_command" }
  const targetId = command.occurrenceId ?? parent.id
  const date = placementDate(command.scope, command.date)
  const scoped = placements.filter(
    (record) => record.scope === command.scope && record.date === date
  )
  const current =
    scoped.find((record) => record.occurrenceId === targetId) ?? null
  if (
    current &&
    (current.deletedAt || current.revision !== operation.baseRevision)
  )
    return { status: "conflict", current }
  if (!current && operation.baseRevision !== 0) return { status: "unavailable" }
  const activeTags = new Set(
    tags.filter((tag) => !tag.deletedAt).map((tag) => tag.id)
  )
  if (command.tagId !== null && !activeTags.has(command.tagId))
    return { status: "invalid_command" }
  const viewMap = new Map(views.map((view) => [view.itemId, view]))
  function effectiveTag(itemId: string) {
    const view = viewMap.get(itemId)
    if (view?.deletedAt) throw new Error("Personal view is unavailable")
    return view?.primaryTagId && activeTags.has(view.primaryTagId)
      ? view.primaryTagId
      : null
  }
  try {
    const catalog = recurringMovementCatalog(
      items,
      occurrences,
      userId,
      command
    )
    const target = catalog.find(
      (item) => item.id === targetId && item.parent.id === parent.id
    )
    if (!target) return { status: "invalid_command" }
    // Category belongs to the parent. Moving it affects every visible sibling, not one slot.
    const destination = catalog.filter(
      (item) =>
        item.parent.id === parent.id ||
        effectiveTag(item.parent.id) === command.tagId
    )
    const ordered = orderPlacedTasks(
      destination.filter(
        (item) =>
          item.id !== targetId || effectiveTag(parent.id) === command.tagId
      ),
      scoped,
      command.tagId,
      compareRecurringMovementItems
    )
    if (!ordered.some((item) => item.id === targetId)) ordered.push(target)
    const effects: PreferenceEffect[] = planTaskPlacements(
      ordered,
      scoped,
      targetId,
      command,
      userId,
      timestamp
    ).map((record) => ({
      store: "taskPlacements",
      record: {
        ...record,
        revision: revisionSchema.parse(record.revision + 1),
      },
    }))
    const previousView = viewMap.get(parent.id) ?? null
    if (previousView?.primaryTagId !== command.tagId) {
      const view = applyItemViewCommand(
        previousView,
        parent,
        tags.find((tag) => tag.id === command.tagId) ?? null,
        {
          type: "item-view.set",
          itemId: parent.id,
          primaryTagId: command.tagId,
        },
        userId,
        timestamp
      )
      effects.push({
        store: "itemViews",
        record: {
          ...view,
          revision: revisionSchema.parse((previousView?.revision ?? 0) + 1),
        },
      })
    }
    const bounded = remotePreferenceEffectsSchema.safeParse({
      version: 1,
      userId,
      operationId: operation.operationId,
      sequence: Number.MAX_SAFE_INTEGER,
      effects,
    })
    return bounded.success
      ? { status: "changes", effects: bounded.data.effects }
      : { status: "invalid_command" }
  } catch {
    return { status: "invalid_command" }
  }
}
