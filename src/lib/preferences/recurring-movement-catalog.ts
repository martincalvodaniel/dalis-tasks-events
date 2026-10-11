import { addCivilDays } from "@/lib/calendar/civil-date"
import { isTaskOverdue } from "@/lib/calendar/overdue"
import { readPlanAppearancePage } from "@/lib/calendar/plan-appearance-page"
import {
  isPlanOverdue,
  planIncludesDate,
  planStartDate,
} from "@/lib/calendar/plan-selection"
import type { PlanAppearanceCursor } from "@/schemas/plan-appearance-query"
import { maximumRemoteTaskCatalog } from "@/schemas/remote-task-placement-planning"
import type { CalendarItem, Task } from "@/types/calendar-item"
import type { Plan, PlanVariant } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"
import type { SyncCommand } from "@/types/sync"

export interface RecurringMovementItem {
  id: string
  parent: Task | Plan
  scheduledDate: string
  createdAt: string
  start: string
  variant: PlanVariant
}
const variantOrder = { task: 0, event: 1, appointment: 2, note: 3 }
export function compareRecurringMovementItems(
  left: RecurringMovementItem,
  right: RecurringMovementItem
) {
  return (
    (left.start < right.start ? -1 : left.start > right.start ? 1 : 0) ||
    variantOrder[left.variant] - variantOrder[right.variant] ||
    (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  )
}
function scheduleStart(record: Plan | PlanOccurrence) {
  return record.schedule.mode === "all_day"
    ? record.schedule.startDate
    : record.schedule.localStart
}
function dueDate(occurrence: PlanOccurrence) {
  return occurrence.schedule.mode === "all_day"
    ? addCivilDays(occurrence.schedule.endDateExclusive, -1)
    : (occurrence.schedule.localEnd ?? occurrence.schedule.localStart).slice(
        0,
        10
      )
}

// Inputs must be validated as complete owned catalogs before selection. No clock is read.
export function recurringMovementCatalog(
  items: readonly CalendarItem[],
  occurrences: readonly PlanOccurrence[],
  actor: string,
  command: Extract<SyncCommand, { type: "task.move" }>
): RecurringMovementItem[] {
  const result: RecurringMovementItem[] = []
  const ids = new Set<string>()
  function append(item: RecurringMovementItem) {
    if (ids.has(item.id)) throw new Error("Duplicate visible movement identity")
    if (result.length === maximumRemoteTaskCatalog)
      throw new Error("Complete recurring movement catalog exceeds its limit")
    ids.add(item.id)
    result.push(item)
  }
  const plans: Plan[] = []
  for (const item of items) {
    if (item.ownerId !== actor)
      throw new Error("Movement parent belongs to another account")
    if (item.kind === "plan") plans.push(item)
    if (
      item.deletedAt ||
      (item.kind !== "task" && item.kind !== "plan") ||
      item.recurrence
    )
      continue
    const selected =
      item.kind === "task"
        ? command.scope === "day"
          ? item.scheduledDate === command.date
          : isTaskOverdue(item, command.date)
        : item.kind === "plan" &&
          (command.scope === "day"
            ? planIncludesDate(item, command.date)
            : isPlanOverdue(item, command.date))
    if (!selected || (item.kind !== "task" && item.kind !== "plan")) continue
    const start =
      item.kind === "task" ? item.scheduledDate : scheduleStart(item)
    append({
      id: item.id,
      parent: item,
      scheduledDate: start.slice(0, 10),
      createdAt: item.createdAt,
      start,
      variant: item.kind === "task" ? "task" : item.variant,
    })
  }
  const parents = new Map(plans.map((plan) => [plan.id, plan]))
  const activeSeries = plans.filter(
    (plan) => plan.recurrence && !plan.deletedAt
  )
  if (!activeSeries.length) return result
  // Overdue is evaluated as-of the civil day in the durable command, including past exceptions.
  const startDate =
    command.scope === "day"
      ? command.date
      : [
          ...activeSeries.map(planStartDate),
          ...occurrences.map((occurrence) =>
            scheduleStart(occurrence).slice(0, 10)
          ),
        ].reduce((left, right) => (left < right ? left : right))
  if (command.scope === "overdue" && startDate >= command.date) return result
  const query = {
    startDate,
    endDate:
      command.scope === "day" ? command.date : addCivilDays(command.date, -1),
    limit: 500,
    includeCompleted: command.scope === "day",
  }
  const exceptions = new Map<string, PlanOccurrence[]>()
  for (const occurrence of occurrences) {
    const records = exceptions.get(occurrence.seriesId) ?? []
    records.push(occurrence)
    exceptions.set(occurrence.seriesId, records)
  }
  let pages = 0
  for (const series of activeSeries) {
    let cursor: PlanAppearanceCursor | null = null
    do {
      if (++pages > maximumRemoteTaskCatalog * 2)
        throw new Error("Recurring movement pagination exceeds its work limit")
      const page = readPlanAppearancePage(
        [series],
        exceptions.get(series.id) ?? [],
        actor,
        query,
        cursor
      )
      if (page.issues.length)
        throw new Error(
          "Recurring movement contains unresolved civil schedule issues"
        )
      for (const { occurrence } of page.views) {
        if (command.scope === "overdue" && dueDate(occurrence) >= command.date)
          continue
        const parent = parents.get(occurrence.seriesId)
        if (!parent)
          throw new Error("Movement appearance parent is unavailable")
        const start = scheduleStart(occurrence)
        append({
          id: occurrence.id,
          parent,
          scheduledDate: start.slice(0, 10),
          createdAt: occurrence.createdAt,
          start,
          variant: parent.variant,
        })
      }
      cursor = page.nextCursor
    } while (cursor)
  }
  return result
}
