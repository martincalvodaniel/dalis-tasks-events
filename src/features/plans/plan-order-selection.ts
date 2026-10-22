import type { PlanAgendaSelection } from "@/features/plans/agenda-selection"
import type { PlanAgendaRow } from "@/features/plans/plan-agenda-rows"
import {
  comparePlans,
  isPlanOverdue,
  planIncludesDate,
  planStartDate,
} from "@/lib/calendar/plan-selection"
import {
  commonItemOrderProjection,
  compareCommonItems,
} from "@/lib/ordering/common-item-order"
import type { RankNeighbors } from "@/lib/ordering/rank"
import { orderPlacedTasks } from "@/lib/ordering/task-order"
import { overduePlacementDate } from "@/schemas/ordering"
import type { Plan } from "@/types/plan-item"
import type { TaskPlacement } from "@/types/preferences"
import type { SyncCommand } from "@/types/sync"

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

function isOrderableRow(row: PlanAgendaRow) {
  return (
    !row.series.deletedAt &&
    !row.plan.deletedAt &&
    Boolean(row.series.recurrence) === Boolean(row.occurrence) &&
    !row.occurrence?.cancelled &&
    !row.occurrence?.deletedAt
  )
}

export function planRowOrderPeers(
  rows: readonly PlanAgendaRow[],
  selection: PlanAgendaSelection,
  row: PlanAgendaRow
): PlanAgendaRow[] {
  if (!isOrderableRow(row)) return []
  const context = planOrderContext(selection, row.plan)
  if (selection.kind === "upcoming" && context.date < selection.date) return []
  const belongs = (record: PlanAgendaRow) =>
    isOrderableRow(record) &&
    (context.scope === "overdue"
      ? isPlanOverdue(record.plan, context.date)
      : selection.kind === "day"
        ? planIncludesDate(record.plan, context.date)
        : planStartDate(record.plan) === context.date)
  return belongs(row) ? rows.filter(belongs) : []
}

export function planRowMoveCommand(
  selection: PlanAgendaSelection,
  row: PlanAgendaRow,
  tagId: string | null,
  neighbors: RankNeighbors
): Extract<SyncCommand, { type: "task.move" }> {
  if (!isOrderableRow(row)) throw new Error("Plan row cannot be reordered")
  return {
    type: "task.move",
    itemId: row.series.id,
    occurrenceId: row.occurrence?.id ?? null,
    tagId,
    ...planOrderContext(selection, row.plan),
    ...neighbors,
  }
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
