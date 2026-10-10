"use client"

import { useLocalPlans } from "@/features/plans/hooks/use-local-plans"
import { useLocalTags } from "@/features/tags/hooks/use-local-tags"
import { useLocalTaskPlacements } from "@/features/tasks/hooks/use-local-task-placements"
import { useLocalIntent } from "@/features/workspace/hooks/use-local-intent"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { openLocalDatabase } from "@/lib/local-db/client"
import { notifyLocalOutboxChange } from "@/lib/local-db/sync-notifications"
import type { TaskMoveCommand } from "@/lib/local-db/task-move-mutation"
import { commitLocalTaskMoveCommand } from "@/lib/local-db/task-move-outbox"

export function usePlanOrder(account: LocalAccount) {
  const { mutate: plans } = useLocalPlans(account)
  const { mutate: tags } = useLocalTags(account)
  const { mutate: placements } = useLocalTaskPlacements(account)
  return useLocalIntent<TaskMoveCommand>(
    async (command, operationId) => {
      await requireActiveAccount(account)
      const database = await openLocalDatabase(account.userId)
      try {
        await requireActiveAccount(account)
        await commitLocalTaskMoveCommand(
          database,
          account.userId,
          command,
          { operationId },
          true
        )
        notifyLocalOutboxChange(account.userId)
      } finally {
        database.close()
      }
    },
    () => Promise.all([plans(), tags(), placements()])
  )
}
