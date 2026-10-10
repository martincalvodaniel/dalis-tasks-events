import {
  comparePlans,
  isPlanOverdue,
  planDueDate,
  planIncludesDate,
} from "@/lib/calendar/plan-selection"
import { compareRank } from "@/lib/ordering/rank"
import { civilDateSchema } from "@/schemas/primitives"
import type { Plan } from "@/types/plan-item"
import type { ItemView, Tag } from "@/types/preferences"

export type PlanAgendaSelection =
  | { kind: "all" }
  | { kind: "day" | "overdue" | "upcoming"; date: string }
export interface PlanAgendaGroup {
  id: string
  title: string
  color: string | null
  plans: Plan[]
}

export function selectAgendaPlans(
  plans: readonly Plan[],
  selection: PlanAgendaSelection
) {
  if (selection.kind === "all")
    return plans.filter((plan) => !plan.deletedAt).toSorted(comparePlans)
  const date = civilDateSchema.parse(selection.date)
  return plans
    .filter(
      (plan) =>
        !plan.deletedAt &&
        !plan.recurrence &&
        (selection.kind === "day"
          ? planIncludesDate(plan, date)
          : selection.kind === "overdue"
            ? isPlanOverdue(plan, date)
            : planDueDate(plan) >= date)
    )
    .toSorted(comparePlans)
}

export function groupAgendaPlans(
  plans: readonly Plan[],
  tags: readonly Tag[],
  views: readonly ItemView[]
): PlanAgendaGroup[] {
  const groups = new Map<string, PlanAgendaGroup>(
    tags
      .filter((tag) => !tag.deletedAt)
      .toSorted(compareRank)
      .map((tag) => [
        tag.id,
        { id: tag.id, title: tag.name, color: tag.color, plans: [] },
      ])
  )
  const assignments = new Map(
    views
      .filter((view) => !view.deletedAt)
      .map((view) => [view.itemId, view.primaryTagId])
  )
  const uncategorized: PlanAgendaGroup = {
    id: "uncategorized",
    title: "Sin categoría",
    color: null,
    plans: [],
  }
  for (const plan of plans.toSorted(comparePlans)) {
    const tagId = assignments.get(plan.id)
    ;(tagId ? (groups.get(tagId) ?? uncategorized) : uncategorized).plans.push(
      plan
    )
  }
  return [...groups.values(), uncategorized].filter(
    (group) => group.plans.length > 0
  )
}
