import type { PlanAgendaSelection } from "@/features/plans/agenda-selection"
import {
  comparePlans,
  planIncludesDate,
  planStartDate,
} from "@/lib/calendar/plan-selection"
import {
  commonItemOrderProjection,
  compareCommonItems,
} from "@/lib/ordering/common-item-order"
import { orderPlacedTasks } from "@/lib/ordering/task-order"
import { overduePlacementDate } from "@/schemas/ordering"
import type { Plan } from "@/types/plan-item"
import type { TaskPlacement } from "@/types/preferences"

export function planOrderContext(selection: PlanAgendaSelection, plan: Plan) {
  return selection.kind === "overdue"
    ? { scope: "overdue" as const, date: selection.date }
    : {
        scope: "day" as const,
        date: selection.kind === "day" ? selection.date : planStartDate(plan),
      }
}
export function planOrderPeers(
  plans: readonly Plan[],
  selection: PlanAgendaSelection,
  plan: Plan
) {
  const context = planOrderContext(selection, plan)
  return plans.filter(
    (record) =>
      !record.recurrence &&
      !record.deletedAt &&
      (context.scope === "overdue" || planIncludesDate(record, context.date))
  )
}
export function orderAgendaGroupPlans(
  plans: readonly Plan[],
  placements: readonly TaskPlacement[],
  selection: PlanAgendaSelection,
  tagId: string | null
): Plan[] {
  const order = (
    items: readonly Plan[],
    scope: "day" | "overdue",
    date: string
  ) =>
    orderPlacedTasks(
      items.map(commonItemOrderProjection),
      placements.filter(
        (record) => record.scope === scope && record.date === date
      ),
      tagId,
      (left, right) => compareCommonItems(left.source, right.source)
    ).map((record) => record.source as Plan)
  if (selection.kind === "overdue")
    return order(plans, "overdue", overduePlacementDate)
  if (selection.kind === "day") return order(plans, "day", selection.date)
  const dates = [...new Set(plans.map(planStartDate))].sort()
  return dates
    .flatMap((date) =>
      order(
        plans.filter((plan) => planStartDate(plan) === date),
        "day",
        date
      )
    )
    .toSorted((left, right) => {
      const leftDate = planStartDate(left),
        rightDate = planStartDate(right)
      return leftDate === rightDate ? 0 : comparePlans(left, right)
    })
}
