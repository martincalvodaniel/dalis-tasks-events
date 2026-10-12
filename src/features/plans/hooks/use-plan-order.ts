"use client"

import { useLocalPlans } from "@/features/plans/hooks/use-local-plans"
import { moveLocalPlan } from "@/features/plans/local-plans"
import { useLocalTags } from "@/features/tags/hooks/use-local-tags"
import { useLocalTaskPlacements } from "@/features/tasks/hooks/use-local-task-placements"
import { useLocalIntent } from "@/features/workspace/hooks/use-local-intent"
import type { LocalAccount } from "@/features/workspace/local-account"
import type { TaskMoveCommand } from "@/lib/local-db/task-move-mutation"

export function usePlanOrder(account: LocalAccount) {
  const { mutate: plans } = useLocalPlans(account)
  const { mutate: tags } = useLocalTags(account)
  const { mutate: placements } = useLocalTaskPlacements(account)
  return useLocalIntent<TaskMoveCommand>(
    (command, operationId) => moveLocalPlan(account, command, operationId),
    () => Promise.all([plans(), tags(), placements()])
  )
}
