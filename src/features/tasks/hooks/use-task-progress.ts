"use client"

import { useLocalTasks } from "@/features/tasks/hooks/use-local-tasks"
import {
  changeLocalTaskProgress,
  type TaskProgressCommand,
} from "@/features/tasks/local-tasks"
import { useLocalIntent } from "@/features/workspace/hooks/use-local-intent"
import type { LocalAccount } from "@/features/workspace/local-account"

export function useTaskProgress(account: LocalAccount) {
  const { mutate } = useLocalTasks(account)
  return useLocalIntent<TaskProgressCommand>(
    (command, operationId) =>
      changeLocalTaskProgress(account, command, operationId),
    () => mutate()
  )
}
