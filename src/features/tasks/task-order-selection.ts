import type { AgendaSelection } from "@/features/tasks/agenda-selection"
import { orderPlacedTasks } from "@/lib/ordering/task-order"
import { overduePlacementDate } from "@/schemas/ordering"
import type { Task } from "@/types/calendar-item"
import type { TaskPlacement } from "@/types/preferences"

export function taskOrderContext(selection: AgendaSelection, task: Task) {
  return selection.kind === "overdue"
    ? { scope: "overdue" as const, date: selection.date }
    : { scope: "day" as const, date: task.scheduledDate }
}

export function taskOrderPeers(
  tasks: readonly Task[],
  selection: AgendaSelection,
  task: Task
) {
  return selection.kind === "overdue"
    ? [...tasks]
    : tasks.filter((record) => record.scheduledDate === task.scheduledDate)
}

export function orderAgendaGroupTasks(
  tasks: readonly Task[],
  placements: readonly TaskPlacement[],
  selection: AgendaSelection,
  tagId: string | null
) {
  if (selection.kind === "overdue")
    return orderPlacedTasks(
      tasks,
      placements.filter(
        (record) =>
          record.scope === "overdue" && record.date === overduePlacementDate
      ),
      tagId
    )
  const dates = [...new Set(tasks.map((task) => task.scheduledDate))].sort()
  return dates.flatMap((date) =>
    orderPlacedTasks(
      tasks.filter((task) => task.scheduledDate === date),
      placements.filter(
        (record) => record.scope === "day" && record.date === date
      ),
      tagId
    )
  )
}
