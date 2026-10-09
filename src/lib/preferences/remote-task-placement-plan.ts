import { isTaskOverdue } from "@/lib/calendar/overdue"
import { orderPlacedTasks } from "@/lib/ordering/task-order"
import { applyItemViewCommand } from "@/lib/preferences/preference-command"
import { planTaskPlacements } from "@/lib/preferences/task-placement-command"
import { placementDate } from "@/schemas/ordering"
import { remotePreferenceEffectsSchema } from "@/schemas/preference-effects"
import { revisionSchema } from "@/schemas/primitives"
import { remoteTaskPlacementPlanningInputSchema } from "@/schemas/remote-task-placement-planning"
import type { Task } from "@/types/calendar-item"
import type { PreferenceEffect } from "@/types/preference-effects"
import type { RemoteTaskPlacementPlan } from "@/types/remote-task-placement-planning"

export function planRemoteTaskPlacementOperation(
  input: unknown
): RemoteTaskPlacementPlan {
  const { userId, timestamp, operation, items, tags, views, placements } =
    remoteTaskPlacementPlanningInputSchema.parse(input)
  const command = operation.command
  if (command.type !== "task.move" || command.occurrenceId !== null)
    return { status: "unsupported" }
  const item = items.find((record) => record.id === command.itemId)
  if (!item || item.deletedAt) return { status: "unavailable" }
  if (item.kind !== "task" || item.recurrence) return { status: "unsupported" }
  const date = placementDate(command.scope, command.date)
  const scoped = placements.filter(
    (record) => record.scope === command.scope && record.date === date
  )
  const current =
    scoped.find((record) => record.occurrenceId === item.id) ?? null
  if (
    current &&
    (current.deletedAt || current.revision !== operation.baseRevision)
  )
    return { status: "conflict", current }
  if (!current && operation.baseRevision !== 0) return { status: "unavailable" }
  // The durable command declares its civil day. A delayed upload must not use the server's current day or time zone.
  if (
    command.scope === "day"
      ? item.scheduledDate !== command.date
      : !isTaskOverdue(item, command.date)
  )
    return { status: "invalid_command" }
  const activeTags = new Set(
    tags.filter((tag) => !tag.deletedAt).map((tag) => tag.id)
  )
  if (command.tagId !== null && !activeTags.has(command.tagId))
    return { status: "invalid_command" }
  const viewMap = new Map(views.map((view) => [view.itemId, view]))
  const effectiveTag = (itemId: string) => {
    const view = viewMap.get(itemId)
    if (view?.deletedAt) throw new Error("Personal view is unavailable")
    return view?.primaryTagId && activeTags.has(view.primaryTagId)
      ? view.primaryTagId
      : null
  }
  try {
    const destination = items.filter(
      (record): record is Task =>
        record.kind === "task" &&
        !record.deletedAt &&
        !record.recurrence &&
        record.id !== item.id &&
        (command.scope === "day"
          ? record.scheduledDate === command.date
          : isTaskOverdue(record, command.date)) &&
        effectiveTag(record.id) === command.tagId
    )
    if (effectiveTag(item.id) === command.tagId) destination.push(item)
    const ordered = orderPlacedTasks(destination, scoped, command.tagId)
    if (!ordered.some((record) => record.id === item.id)) ordered.push(item)
    const changed = planTaskPlacements(
      ordered,
      scoped,
      item.id,
      command,
      userId,
      timestamp
    )
    const effects: PreferenceEffect[] = changed.map((record) => ({
      store: "taskPlacements",
      record: {
        ...record,
        revision: revisionSchema.parse(record.revision + 1),
      },
    }))
    const previousView = viewMap.get(item.id) ?? null
    if (previousView?.primaryTagId !== command.tagId) {
      const view = applyItemViewCommand(
        previousView,
        item,
        tags.find((tag) => tag.id === command.tagId) ?? null,
        { type: "item-view.set", itemId: item.id, primaryTagId: command.tagId },
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
