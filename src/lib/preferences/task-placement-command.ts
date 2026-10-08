import { planRankMove } from "@/lib/ordering/rank"
import type { OrderableTask } from "@/lib/ordering/task-order"
import { placementDate } from "@/schemas/ordering"
import { taskPlacementSchema } from "@/schemas/preferences"
import { positionSchema } from "@/schemas/primitives"
import type { TaskPlacement } from "@/types/preferences"
import type { SyncCommand } from "@/types/sync"

export type TaskMoveCommand = Extract<SyncCommand, { type: "task.move" }>

export function planTaskPlacements(
  ordered: readonly OrderableTask[],
  scoped: readonly TaskPlacement[],
  targetId: string,
  command: TaskMoveCommand,
  userId: string,
  timestamp: string
): TaskPlacement[] {
  const date = placementDate(command.scope, command.date)
  const compatible = new Map(
    scoped
      .filter((record) => !record.deletedAt && record.tagId === command.tagId)
      .map((record) => [record.occurrenceId, record])
  )
  let lastPosition = 0
  const ranks = ordered.map((task) => {
    const stored = compatible.get(task.id)
    const position = stored?.position ?? lastPosition + 1024
    lastPosition = position
    return { id: task.id, position }
  })
  if (
    ranks.some((record) => !positionSchema.safeParse(record.position).success)
  )
    for (const [index, record] of ranks.entries())
      record.position = positionSchema.parse(
        (index - Math.floor(ranks.length / 2)) * 1024
      )
  const changes = planRankMove(ranks, targetId, command)
  const planned = ranks.map((rank) => ({
    ...rank,
    position: changes.get(rank.id) ?? rank.position,
  }))
  const records: TaskPlacement[] = []
  for (const rank of planned) {
    const previous = scoped.find((record) => record.occurrenceId === rank.id)
    if (previous?.deletedAt)
      throw new Error("Deleted task placement cannot be restored")
    if (
      rank.id !== targetId &&
      previous?.tagId === command.tagId &&
      previous.position === rank.position
    )
      continue
    records.push(
      taskPlacementSchema.parse({
        userId,
        occurrenceId: rank.id,
        scope: command.scope,
        date,
        tagId: command.tagId,
        position: rank.position,
        revision: previous?.revision ?? 0,
        createdAt: previous?.createdAt ?? timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      })
    )
  }
  return records
}
