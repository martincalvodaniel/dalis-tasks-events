import { addCivilDays } from "@/lib/calendar/civil-date"
import { civilDateSchema } from "@/schemas/primitives"
import type { Plan, PlanVariant } from "@/types/plan-item"

const variantOrder: Record<PlanVariant, number> = {
  task: 0,
  event: 1,
  appointment: 2,
  note: 3,
}

export function planStartDate(plan: Plan): string {
  return plan.schedule.mode === "all_day"
    ? plan.schedule.startDate
    : plan.schedule.localStart.slice(0, 10)
}

export function planDueDate(plan: Plan): string {
  return plan.schedule.mode === "all_day"
    ? addCivilDays(plan.schedule.endDateExclusive, -1)
    : (plan.schedule.localEnd ?? plan.schedule.localStart).slice(0, 10)
}

export function isPlanOverdue(plan: Plan, today: string): boolean {
  const date = civilDateSchema.parse(today)
  return (
    !plan.deletedAt &&
    !plan.recurrence &&
    plan.status !== "completed" &&
    planDueDate(plan) < date
  )
}

export function planIncludesDate(plan: Plan, dateInput: string): boolean {
  const date = civilDateSchema.parse(dateInput)
  return (
    !plan.deletedAt &&
    !plan.recurrence &&
    planStartDate(plan) <= date &&
    planDueDate(plan) >= date
  )
}

export function comparePlans(left: Plan, right: Plan): number {
  const leftStart =
    left.schedule.mode === "all_day"
      ? left.schedule.startDate
      : left.schedule.localStart
  const rightStart =
    right.schedule.mode === "all_day"
      ? right.schedule.startDate
      : right.schedule.localStart
  return leftStart < rightStart
    ? -1
    : leftStart > rightStart
      ? 1
      : variantOrder[left.variant] - variantOrder[right.variant] ||
        (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
}
