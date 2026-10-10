import { planStartDate } from "@/lib/calendar/plan-selection"
import type { Task } from "@/types/calendar-item"
import type { Plan } from "@/types/plan-item"

export type CommonOrderItem = Task | Plan
const variantOrder = { task: 0, event: 1, appointment: 2, note: 3 }

export function commonItemOrderProjection(item: CommonOrderItem) {
  return {
    id: item.id,
    scheduledDate:
      item.kind === "plan" ? planStartDate(item) : item.scheduledDate,
    createdAt: item.createdAt,
    source: item,
  }
}

export function compareCommonItems(
  left: CommonOrderItem,
  right: CommonOrderItem
) {
  function start(item: CommonOrderItem) {
    if (item.kind === "task") return item.scheduledDate
    return item.schedule.mode === "all_day"
      ? item.schedule.startDate
      : item.schedule.localStart
  }
  const leftStart = start(left),
    rightStart = start(right)
  return (
    (leftStart < rightStart ? -1 : leftStart > rightStart ? 1 : 0) ||
    variantOrder[left.kind === "plan" ? left.variant : "task"] -
      variantOrder[right.kind === "plan" ? right.variant : "task"] ||
    (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  )
}
