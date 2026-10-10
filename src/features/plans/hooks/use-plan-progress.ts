"use client"

import { useLocalPlans } from "@/features/plans/hooks/use-local-plans"
import {
  changeLocalPlanProgress,
  type PlanProgressCommand,
} from "@/features/plans/local-plans"
import { useLocalIntent } from "@/features/workspace/hooks/use-local-intent"
import type { LocalAccount } from "@/features/workspace/local-account"

export function usePlanProgress(account: LocalAccount) {
  const { mutate } = useLocalPlans(account)
  return useLocalIntent<PlanProgressCommand>(
    (command, operationId) =>
      changeLocalPlanProgress(account, command, operationId),
    () => mutate()
  )
}
