"use client"

import { useLocalPlans } from "@/features/plans/hooks/use-local-plans"
import {
  changeLocalPlanOccurrence,
  updateLocalPlan,
} from "@/features/plans/local-plans"
import type { PlanAgendaRow } from "@/features/plans/plan-agenda-rows"
import { useLocalIntent } from "@/features/workspace/hooks/use-local-intent"
import type { LocalAccount } from "@/features/workspace/local-account"
import { rescheduledPlanInput } from "@/lib/calendar/plan-reschedule"
import { planStartDate } from "@/lib/calendar/plan-selection"

export function usePlanReschedule(account: LocalAccount) {
  const { mutate } = useLocalPlans(account)
  return useLocalIntent<{ row: PlanAgendaRow; date: string }>(
    async ({ row, date }, operationId) => {
      if (date === planStartDate(row.plan)) return
      const input = rescheduledPlanInput(row.plan, date)
      if (row.occurrence)
        await changeLocalPlanOccurrence(
          account,
          {
            type: "plan.update-occurrence",
            itemId: row.series.id,
            occurrenceId: row.occurrence.id,
            input: {
              title: input.title,
              description: input.description,
              schedule: input.schedule,
              checklist: input.checklist.map(({ id, text }) => ({ id, text })),
            },
          },
          {
            operationId,
            expectedItem: row.series,
            expectedOccurrence: row.occurrence,
          }
        )
      else await updateLocalPlan(account, row.series, input, operationId)
    },
    () => mutate()
  )
}
