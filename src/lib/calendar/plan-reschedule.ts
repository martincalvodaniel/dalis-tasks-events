import { projectOccurrenceSchedule } from "@/lib/calendar/occurrence-schedule"
import { planInputSchema } from "@/schemas/plan-input"
import { planSchema } from "@/schemas/plan-item"
import { civilDateSchema } from "@/schemas/primitives"
import type { Plan } from "@/types/plan-item"

export function rescheduledPlanInput(input: Plan, dateInput: string) {
  const plan = planSchema.parse(input)
  const date = civilDateSchema.parse(dateInput)
  if (plan.deletedAt || plan.recurrence)
    throw new Error(
      "Rescheduling requires an active simple plan or projected appearance"
    )
  return planInputSchema.parse({
    kind: "plan",
    variant: plan.variant,
    title: plan.title,
    description: plan.description,
    status: plan.status,
    checklist: plan.checklist,
    recurrence: null,
    schedule: projectOccurrenceSchedule(plan.schedule, date),
  })
}
