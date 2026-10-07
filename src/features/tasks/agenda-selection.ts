import { isTaskOverdue } from "@/lib/calendar/overdue"
import { compareRank } from "@/lib/ordering/rank"
import { civilDateSchema } from "@/schemas/primitives"
import type { Task } from "@/types/calendar-item"
import type { Tag } from "@/types/preferences"

export type AgendaSelection =
  | { kind: "all" }
  | { kind: "day" | "overdue" | "upcoming"; date: string }
export interface AgendaCategories {
  tags: readonly Tag[]
  views: Readonly<Record<string, string | null>>
}
export interface AgendaGroup {
  id: string
  title: string
  tasks: Task[]
}

export function selectAgendaTasks(
  tasks: readonly Task[],
  selection: AgendaSelection
): Task[] {
  if (selection.kind === "all")
    return tasks.filter((task) => !task.deletedAt && !task.recurrence)
  const date = civilDateSchema.parse(selection.date)
  return tasks.filter((task) => {
    if (task.deletedAt || task.recurrence) return false
    if (selection.kind === "overdue") return isTaskOverdue(task, date)
    return selection.kind === "day"
      ? task.scheduledDate === date
      : task.scheduledDate >= date
  })
}

export function groupAgendaTasks(
  tasks: readonly Task[],
  categories?: AgendaCategories
): AgendaGroup[] {
  if (!tasks.length) return []
  if (!categories)
    return [{ id: "unavailable", title: "Tareas", tasks: [...tasks] }]
  const tags = categories.tags
    .filter((tag) => !tag.deletedAt)
    .toSorted(compareRank)
  const groups = new Map<string, AgendaGroup>(
    tags.map((tag) => [tag.id, { id: tag.id, title: tag.name, tasks: [] }])
  )
  const uncategorized: AgendaGroup = {
    id: "uncategorized",
    title: "Sin categoría",
    tasks: [],
  }
  for (const task of tasks) {
    const tagId = categories.views[task.id]
    const group = tagId ? groups.get(tagId) : undefined
    const target = group ?? uncategorized
    target.tasks.push(task)
  }
  return [...groups.values(), uncategorized].filter(
    (group) => group.tasks.length > 0
  )
}
