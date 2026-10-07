"use client"

import { useLocalTags } from "@/features/tags/hooks/use-local-tags"
import { useLocalTaskPlacements } from "@/features/tasks/hooks/use-local-task-placements"
import { useLocalTasks } from "@/features/tasks/hooks/use-local-tasks"
import {
  changeLocalTaskOrder,
  type TaskMoveCommand,
} from "@/features/tasks/local-ordering"
import { useLocalIntent } from "@/features/workspace/hooks/use-local-intent"
import type { LocalAccount } from "@/features/workspace/local-account"

export function useTaskOrder(account: LocalAccount) {
  const { mutate: tasks } = useLocalTasks(account)
  const { mutate: tags } = useLocalTags(account)
  const { mutate: placements } = useLocalTaskPlacements(account)
  return useLocalIntent<TaskMoveCommand>(
    (command, operationId) =>
      changeLocalTaskOrder(account, command, operationId),
    () => Promise.all([tasks(), tags(), placements()])
  )
}
