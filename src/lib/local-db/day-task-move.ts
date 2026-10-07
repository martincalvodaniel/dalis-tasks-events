"use client"

import { createTaskOccurrenceIndex } from "@/lib/calendar/task-occurrence-selection"
import { applyLocalItemViewCommand } from "@/lib/local-db/preference-mutation"
import type {
  TaskMoveCommand,
  TaskMoveSnapshot,
} from "@/lib/local-db/task-move-mutation"
import { planTaskPlacements } from "@/lib/local-db/task-placement-mutation"
import { type OrderableTask, orderPlacedTasks } from "@/lib/ordering/task-order"
import type { ItemView, TaskPlacement } from "@/types/preferences"

interface DayTask extends OrderableTask {
  seriesId: string
}
export function planLocalDayTaskMove(
  snapshot: TaskMoveSnapshot,
  command: TaskMoveCommand,
  userId: string,
  timestamp: string
): {
  placements: TaskPlacement[]
  view: ItemView | null
  current: TaskPlacement | null
} {
  if (command.scope !== "day")
    throw new Error("Day movement requires a day scope")
  const { items, tags, views, placements, settings } = snapshot
  if (
    [...tags, ...views, ...placements, ...(settings ? [settings] : [])].some(
      (record) => record.userId !== userId
    )
  )
    throw new Error("Personal record belongs to another account")
  const parent = items.find((record) => record.id === command.itemId)
  if (
    parent?.kind !== "task" ||
    parent.deletedAt ||
    parent.ownerId !== userId ||
    Boolean(parent.recurrence) !== Boolean(command.occurrenceId)
  )
    throw new Error("Active task movement target is unavailable")
  const activeTags = new Set(
    tags.filter((tag) => !tag.deletedAt).map((tag) => tag.id)
  )
  if (command.tagId && !activeTags.has(command.tagId))
    throw new Error("Destination category is unavailable")
  const index = createTaskOccurrenceIndex(
    items,
    snapshot.occurrences ?? [],
    userId
  )
  const query = { startDate: command.date, endDate: command.date, limit: 500 }
  const candidates: DayTask[] = items
    .filter(
      (item) =>
        item.kind === "task" &&
        !item.deletedAt &&
        !item.recurrence &&
        item.ownerId === userId &&
        item.scheduledDate === command.date
    )
    .map((item) => ({
      id: item.id,
      seriesId: item.id,
      scheduledDate: command.date,
      createdAt: item.createdAt,
    }))
  for (const seriesId of index.seriesIds)
    for (const result of index.generatedPage(seriesId, query).views)
      candidates.push({ ...result.occurrence, seriesId })
  let after: { date: string; id: string } | null = null
  do {
    const page = index.exceptionsPage({ ...query, after })
    for (const result of page.views)
      candidates.push({ ...result.occurrence, seriesId: result.seriesId })
    after = page.nextCursor
  } while (after)
  const targetId = command.occurrenceId ?? command.itemId
  const target = candidates.find(
    (item) => item.id === targetId && item.seriesId === parent.id
  )
  if (!target) throw new Error("Task no longer belongs to the selected day")
  const viewMap = new Map(views.map((view) => [view.itemId, view]))
  function effectiveTag(seriesId: string) {
    const stored = viewMap.get(seriesId)
    if (stored?.deletedAt) throw new Error("Personal view is unavailable")
    return stored?.primaryTagId && activeTags.has(stored.primaryTagId)
      ? stored.primaryTagId
      : null
  }
  const destination = candidates.filter(
    (item) =>
      item.seriesId === parent.id ||
      effectiveTag(item.seriesId) === command.tagId
  )
  const scoped = placements.filter(
    (record) => record.scope === "day" && record.date === command.date
  )
  const current =
    scoped.find((record) => record.occurrenceId === targetId) ?? null
  if (current?.deletedAt)
    throw new Error("Deleted task placement cannot be restored")
  const ordered = orderPlacedTasks(
    destination.filter(
      (item) =>
        item.id !== targetId || effectiveTag(parent.id) === command.tagId
    ),
    scoped,
    command.tagId
  )
  if (!ordered.some((item) => item.id === targetId)) ordered.push(target)
  const previousView = viewMap.get(parent.id) ?? null
  const view =
    previousView?.primaryTagId === command.tagId
      ? null
      : applyLocalItemViewCommand(
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
  return {
    placements: planTaskPlacements(
      ordered,
      scoped,
      targetId,
      command,
      userId,
      timestamp
    ),
    view,
    current,
  }
}
