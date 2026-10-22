import { createPlanAgendaRows } from "@/features/plans/plan-agenda-rows"
import { addCivilDays } from "@/lib/calendar/civil-date"
import { readPlanAppearanceSelection } from "@/lib/calendar/plan-appearance-selection"
import type { PlanOccurrenceView } from "@/lib/calendar/plan-occurrence-selection"
import { planIncludesDate } from "@/lib/calendar/plan-selection"
import { civilDateSchema } from "@/schemas/primitives"
import type { Plan } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"

// Counts reflect the loaded appearance pages; the UI exposes any remaining cursor.
export function planCalendarSummary(
  plans: readonly Plan[],
  appearances: readonly PlanOccurrenceView[],
  range: { startDate: string; endDate: string }
) {
  const start = civilDateSchema.parse(range.startDate)
  const end = civilDateSchema.parse(range.endDate)
  if (end < start) throw new Error("Plan calendar range end precedes its start")
  const rows = createPlanAgendaRows(plans, appearances, {
    kind: "upcoming",
    date: start,
  })
  const counts = new Map<string, number>()
  const incompleteDates = new Set<string>()
  let date = start
  let days = 0
  while (date <= end) {
    if (++days > 42)
      throw new Error("Plan calendar range exceeds its month grid limit")
    const visible = rows.filter((row) => planIncludesDate(row.plan, date))
    counts.set(date, visible.length)
    if (visible.some((row) => row.plan.status !== "completed"))
      incompleteDates.add(date)
    if (date === end) break
    date = addCivilDays(date, 1)
  }
  return { counts, incompleteDates }
}

export function planCalendarCounts(
  plans: readonly Plan[],
  appearances: readonly PlanOccurrenceView[],
  range: { startDate: string; endDate: string }
) {
  return planCalendarSummary(plans, appearances, range).counts
}

export function readPlanCalendarAppearances(
  plans: readonly Plan[],
  occurrences: readonly PlanOccurrence[],
  userId: string,
  range: { startDate: string; endDate: string }
) {
  // Reuse the grid range guard before expanding recurring slots.
  planCalendarSummary([], [], range)
  return readPlanAppearanceSelection(
    plans,
    occurrences,
    userId,
    { ...range, limit: 500 },
    50
  )
}
