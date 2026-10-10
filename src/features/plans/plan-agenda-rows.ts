import { z } from "zod"
import {
  type PlanAgendaSelection,
  selectAgendaPlans,
} from "@/features/plans/agenda-selection"
import { addCivilDays } from "@/lib/calendar/civil-date"
import type { PlanOccurrenceView } from "@/lib/calendar/plan-occurrence-selection"
import {
  comparePlans,
  isPlanOverdue,
  planDueDate,
  planIncludesDate,
  planStartDate,
} from "@/lib/calendar/plan-selection"
import { compareRank } from "@/lib/ordering/rank"
import { orderPlacedTasks } from "@/lib/ordering/task-order"
import { overduePlacementDate } from "@/schemas/ordering"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import { civilDateSchema } from "@/schemas/primitives"
import type { Plan } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"
import type { ItemView, Tag, TaskPlacement } from "@/types/preferences"

const plansSchema = z.array(planSchema).max(10000)
const exceptionsSchema = z.array(planOccurrenceSchema).max(10000)
export interface PlanAgendaRow {
  key: string
  plan: Plan
  series: Plan
  occurrence: PlanOccurrence | null
}
export interface PlanAgendaRowGroup {
  id: string
  title: string
  color: string | null
  rows: PlanAgendaRow[]
}
function compareRows(left: PlanAgendaRow, right: PlanAgendaRow): number {
  return (
    comparePlans(left.plan, right.plan) ||
    (left.key < right.key ? -1 : left.key > right.key ? 1 : 0)
  )
}

export function createPlanAgendaRows(
  plansInput: readonly Plan[],
  appearances: readonly PlanOccurrenceView[],
  selection: PlanAgendaSelection
): PlanAgendaRow[] {
  const plans = plansSchema.parse(plansInput)
  const parents = new Map<string, Plan>()
  for (const parent of plans) {
    if (parents.has(parent.id))
      throw new Error("Duplicate plan agenda parent identity")
    parents.set(parent.id, parent)
  }
  const rows: PlanAgendaRow[] = selectAgendaPlans(plans, selection).map(
    (plan) => ({
      key: plan.id,
      plan: planSchema.parse(plan),
      series: planSchema.parse(plan),
      occurrence: null,
    })
  )
  if (selection.kind !== "all") {
    const date = civilDateSchema.parse(selection.date)
    for (const appearance of appearances) {
      const occurrence = planOccurrenceSchema.parse(appearance.occurrence)
      const parent = parents.get(appearance.seriesId)
      if (!parent?.recurrence || parent.id !== occurrence.seriesId)
        throw new Error(
          "Plan agenda occurrence requires its matching recurring parent"
        )
      if (parent.deletedAt || occurrence.cancelled || occurrence.deletedAt)
        continue
      const plan = planSchema.parse({
        ...parent,
        title: occurrence.content?.title ?? parent.title,
        description: occurrence.content?.description ?? parent.description,
        schedule: occurrence.schedule,
        status: occurrence.status,
        checklist: occurrence.checklist,
        completedAt: occurrence.completedAt,
        recurrence: null,
      })
      const visible =
        selection.kind === "day"
          ? planIncludesDate(plan, date)
          : selection.kind === "overdue"
            ? isPlanOverdue(plan, date)
            : planDueDate(plan) >= date
      if (visible)
        rows.push({
          key: occurrence.id,
          plan,
          series: planSchema.parse(parent),
          occurrence,
        })
    }
  }
  const keys = new Set(rows.map((row) => row.key))
  if (keys.size !== rows.length)
    throw new Error("Duplicate plan agenda row identity")
  return rows.toSorted(compareRows)
}

export function groupPlanAgendaRows(
  rows: readonly PlanAgendaRow[],
  tags: readonly Tag[],
  views: readonly ItemView[]
): PlanAgendaRowGroup[] {
  const groups = new Map<string, PlanAgendaRowGroup>(
    tags
      .filter((tag) => !tag.deletedAt)
      .toSorted(compareRank)
      .map((tag) => [
        tag.id,
        { id: tag.id, title: tag.name, color: tag.color, rows: [] },
      ])
  )
  const assignments = new Map(
    views
      .filter((view) => !view.deletedAt)
      .map((view) => [view.itemId, view.primaryTagId])
  )
  const uncategorized: PlanAgendaRowGroup = {
    id: "uncategorized",
    title: "Sin categoría",
    color: null,
    rows: [],
  }
  for (const row of rows.toSorted(compareRows)) {
    const tagId = assignments.get(row.series.id)
    const group = tagId ? (groups.get(tagId) ?? uncategorized) : uncategorized
    group.rows.push(structuredClone(row))
  }
  return [...groups.values(), uncategorized].filter(
    (group) => group.rows.length > 0
  )
}

export function orderPlanAgendaRows(
  rows: readonly PlanAgendaRow[],
  placements: readonly TaskPlacement[],
  selection: PlanAgendaSelection,
  tagId: string | null
): PlanAgendaRow[] {
  const order = (
    source: readonly PlanAgendaRow[],
    scope: "day" | "overdue",
    date: string
  ) =>
    orderPlacedTasks(
      source.map((row) => ({
        id: row.key,
        scheduledDate: planStartDate(row.plan),
        createdAt: row.occurrence?.createdAt ?? row.plan.createdAt,
        source: row,
      })),
      placements.filter(
        (placement) => placement.scope === scope && placement.date === date
      ),
      tagId,
      (left, right) => compareRows(left.source, right.source)
    ).map((record) => structuredClone(record.source))
  if (selection.kind === "overdue") {
    civilDateSchema.parse(selection.date)
    return order(rows, "overdue", overduePlacementDate)
  }
  if (selection.kind === "day")
    return order(rows, "day", civilDateSchema.parse(selection.date))
  if (selection.kind === "upcoming") civilDateSchema.parse(selection.date)
  const dates = [...new Set(rows.map((row) => planStartDate(row.plan)))].sort()
  return dates.flatMap((date) =>
    order(
      rows.filter((row) => planStartDate(row.plan) === date),
      "day",
      date
    )
  )
}

export function planAppearanceRange(
  plansInput: readonly Plan[],
  exceptionsInput: readonly PlanOccurrence[],
  selection: PlanAgendaSelection,
  upcomingEndDate: string
): { startDate: string; endDate: string } | null {
  const horizon = civilDateSchema.parse(upcomingEndDate)
  const plans = plansSchema.parse(plansInput)
  const exceptions = exceptionsSchema.parse(exceptionsInput)
  if (selection.kind === "all") return null
  const date = civilDateSchema.parse(selection.date)
  const active = plans.filter(
    (parent) => parent.recurrence && !parent.deletedAt
  )
  if (!active.length) return null
  if (selection.kind === "day") return { startDate: date, endDate: date }
  if (selection.kind === "upcoming") {
    if (horizon < date)
      throw new Error("Plan appearance horizon precedes its start")
    return { startDate: date, endDate: horizon }
  }
  if (date === "0001-01-01") return null
  const ids = new Set(active.map((parent) => parent.id))
  const starts = active.map(
    (parent) => parent.recurrence?.anchorDate ?? planStartDate(parent)
  )
  for (const occurrence of exceptions)
    if (ids.has(occurrence.seriesId))
      starts.push(
        occurrence.schedule.mode === "all_day"
          ? occurrence.schedule.startDate
          : occurrence.schedule.localStart.slice(0, 10)
      )
  const startDate = starts.toSorted()[0]
  const endDate = addCivilDays(date, -1)
  return startDate <= endDate ? { startDate, endDate } : null
}
