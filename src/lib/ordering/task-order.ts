import { compareRank } from "@/lib/ordering/rank"
import type { TaskPlacement } from "@/types/preferences"

export interface OrderableTask {
  id: string
  scheduledDate: string
  createdAt: string
}

export function compareDefaultTaskOrder(
  left: OrderableTask,
  right: OrderableTask
): number {
  return (
    left.scheduledDate.localeCompare(right.scheduledDate) ||
    left.createdAt.localeCompare(right.createdAt) ||
    (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  )
}

export function orderPlacedTasks<Task extends OrderableTask>(
  tasks: readonly Task[],
  placements: readonly TaskPlacement[],
  tagId: string | null,
  compareDefault: (left: Task, right: Task) => number = compareDefaultTaskOrder
): Task[] {
  const ranks = new Map(
    placements
      .filter((placement) => !placement.deletedAt && placement.tagId === tagId)
      .map((placement) => [placement.occurrenceId, placement.position])
  )
  return tasks.toSorted((left, right) => {
    const leftPosition = ranks.get(left.id)
    const rightPosition = ranks.get(right.id)
    if (leftPosition !== undefined && rightPosition !== undefined)
      return compareRank(
        { id: left.id, position: leftPosition },
        { id: right.id, position: rightPosition }
      )
    if (leftPosition !== undefined) return -1
    if (rightPosition !== undefined) return 1
    return compareDefault(left, right)
  })
}
