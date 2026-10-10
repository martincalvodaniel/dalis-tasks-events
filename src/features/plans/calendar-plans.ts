import { createPlanAgendaRows } from "@/features/plans/plan-agenda-rows"
import { addCivilDays } from "@/lib/calendar/civil-date"
import type { PlanOccurrenceView } from "@/lib/calendar/plan-occurrence-selection"
import { planIncludesDate } from "@/lib/calendar/plan-selection"
import { civilDateSchema } from "@/schemas/primitives"
import type { Plan } from "@/types/plan-item"

// Counts reflect the loaded appearance pages; the UI exposes any remaining cursor.
export function planCalendarCounts(
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
  let date = start
  let days = 0
  while (date <= end) {
    if (++days > 42)
      throw new Error("Plan calendar range exceeds its month grid limit")
    counts.set(
      date,
      rows.filter((row) => planIncludesDate(row.plan, date)).length
    )
    if (date === end) break
    date = addCivilDays(date, 1)
  }
  return counts
}
