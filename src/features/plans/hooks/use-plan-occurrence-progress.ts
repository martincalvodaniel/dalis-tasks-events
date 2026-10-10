"use client"

import { useLocalPlans } from "@/features/plans/hooks/use-local-plans"
import { changeLocalPlanOccurrence } from "@/features/plans/local-plans"
import { useLocalIntent } from "@/features/workspace/hooks/use-local-intent"
import type { LocalAccount } from "@/features/workspace/local-account"
import type { LocalPlanOccurrenceCommand } from "@/types/local-sync"
import type { Plan } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"

export interface PlanOccurrenceIntent {
  command: LocalPlanOccurrenceCommand
  expectedItem: Plan
  expectedOccurrence: PlanOccurrence
}

export function usePlanOccurrenceProgress(account: LocalAccount) {
  const { mutate } = useLocalPlans(account)
  return useLocalIntent<PlanOccurrenceIntent>(
    ({ command, expectedItem, expectedOccurrence }, operationId) =>
      changeLocalPlanOccurrence(account, command, {
        operationId,
        expectedItem,
        expectedOccurrence,
      }),
    () => mutate()
  )
}
