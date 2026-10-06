import { type Clock, todayInTimeZone } from "@/lib/calendar/civil-date"
import { civilDateSchema } from "@/schemas/primitives"
import type { CalendarItem, ItemOccurrence, Task } from "@/types/calendar-item"

type TaskOccurrence = Extract<ItemOccurrence, { kind: "task" }>
export type OverdueTask = Task | TaskOccurrence

export function isTaskOverdue(
  item: CalendarItem | ItemOccurrence,
  today: string
): item is OverdueTask {
  const validToday = civilDateSchema.parse(today)
  if (item.kind !== "task" || item.deletedAt || item.status === "completed") {
    return false
  }
  if ("cancelled" in item && item.cancelled) return false
  // A recurring parent is a schedule; its individual occurrences carry status.
  if ("recurrence" in item && item.recurrence) return false
  return item.scheduledDate < validToday
}

export function selectOverdueTasks(
  items: readonly (CalendarItem | ItemOccurrence)[],
  timeZone: string,
  clock?: Clock
): OverdueTask[] {
  const today = todayInTimeZone(timeZone, clock)
  return items
    .filter((item): item is OverdueTask => isTaskOverdue(item, today))
    .sort((left, right) =>
      left.scheduledDate === right.scheduledDate
        ? left.id.localeCompare(right.id)
        : left.scheduledDate.localeCompare(right.scheduledDate)
    )
}
