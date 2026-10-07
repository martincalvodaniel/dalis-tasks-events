"use client"

import { todayInTimeZone } from "@/lib/calendar/civil-date"
import { isTaskOverdue } from "@/lib/calendar/overdue"
import { planLocalDayTaskMove } from "@/lib/local-db/day-task-move"
import { applyLocalItemViewCommand } from "@/lib/local-db/preference-mutation"
import { planTaskPlacements } from "@/lib/local-db/task-placement-mutation"
import { orderPlacedTasks } from "@/lib/ordering/task-order"
import { overduePlacementDate, placementDate } from "@/schemas/ordering"
import type { CalendarItem, ItemOccurrence, Task } from "@/types/calendar-item"
import type { LocalPreferenceCommand } from "@/types/local-sync"
import type {
  ItemView,
  Tag,
  TaskPlacement,
  UserSettings,
} from "@/types/preferences"

export type TaskMoveCommand = Extract<
  LocalPreferenceCommand,
  { type: "task.move" }
>
export interface TaskMoveSnapshot {
  items: CalendarItem[]
  occurrences?: ItemOccurrence[]
  tags: Tag[]
  views: ItemView[]
  placements: TaskPlacement[]
  settings: UserSettings | null
}

export function planLocalTaskMove(
  snapshot: TaskMoveSnapshot,
  command: TaskMoveCommand,
  userId: string,
  timestamp: string
): {
  placements: TaskPlacement[]
  view: ItemView | null
  current: TaskPlacement | null
} {
  const { items, tags, views, placements, settings } = snapshot
  if (command.scope === "day")
    return planLocalDayTaskMove(snapshot, command, userId, timestamp)
  if (command.occurrenceId !== null)
    throw new Error("Occurrence movement requires its own mutation layer")
  if (
    [...tags, ...views, ...placements, ...(settings ? [settings] : [])].some(
      (record) => record.userId !== userId
    )
  )
    throw new Error("Personal record belongs to another account")
  const item = items.find((record) => record.id === command.itemId)
  if (
    item?.kind !== "task" ||
    item.deletedAt ||
    item.recurrence ||
    item.ownerId !== userId
  )
    throw new Error("Active non-recurring task does not exist in this account")
  const activeTags = new Set(
    tags.filter((tag) => !tag.deletedAt).map((tag) => tag.id)
  )
  if (command.tagId && !activeTags.has(command.tagId))
    throw new Error("Destination category is unavailable")
  if (command.scope === "overdue") {
    if (!settings || settings.deletedAt)
      throw new Error("Account time zone is unavailable")
    const today = todayInTimeZone(settings.timeZone, () => new Date(timestamp))
    if (command.date !== today || !isTaskOverdue(item, today))
      throw new Error(
        "Overdue movement requires the current account day and an overdue task"
      )
    if (
      placements.some(
        (placement) =>
          !placement.deletedAt &&
          placement.scope === "overdue" &&
          placement.date !== overduePlacementDate
      )
    )
      throw new Error("Legacy overdue placements require a separate migration")
  } else if (item.scheduledDate !== command.date)
    throw new Error("Task no longer belongs to the selected day")

  const date = placementDate(command.scope, command.date)
  const scoped = placements.filter(
    (record) => record.scope === command.scope && record.date === date
  )
  const current =
    scoped.find((record) => record.occurrenceId === item.id) ?? null
  if (current?.deletedAt)
    throw new Error("Deleted task placement cannot be restored")
  const viewMap = new Map(views.map((view) => [view.itemId, view]))
  function effectiveTag(taskId: string) {
    const view = viewMap.get(taskId)
    if (view?.deletedAt) throw new Error("Personal view is unavailable")
    return view?.primaryTagId && activeTags.has(view.primaryTagId)
      ? view.primaryTagId
      : null
  }
  const destination = items.filter(
    (record): record is Task =>
      record.kind === "task" &&
      !record.deletedAt &&
      !record.recurrence &&
      record.ownerId === userId &&
      record.id !== item.id &&
      (command.scope === "day"
        ? record.scheduledDate === command.date
        : isTaskOverdue(record, command.date)) &&
      effectiveTag(record.id) === command.tagId
  )
  if (effectiveTag(item.id) === command.tagId) destination.push(item)
  const ordered = orderPlacedTasks(destination, scoped, command.tagId)
  if (!ordered.some((record) => record.id === item.id)) ordered.push(item)
  const records = planTaskPlacements(
    ordered,
    scoped,
    item.id,
    command,
    userId,
    timestamp
  )
  const previousView = viewMap.get(item.id) ?? null
  const view =
    previousView?.primaryTagId === command.tagId
      ? null
      : applyLocalItemViewCommand(
          previousView,
          item,
          tags.find((tag) => tag.id === command.tagId) ?? null,
          {
            type: "item-view.set",
            itemId: item.id,
            primaryTagId: command.tagId,
          },
          userId,
          timestamp
        )
  return { placements: records, view, current }
}
