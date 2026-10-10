import { z } from "zod"
import { addCivilDays, civilDateToUtc } from "@/lib/calendar/civil-date"
import type { OccurrenceScheduleIssue } from "@/lib/calendar/occurrences"
import {
  createPlanOccurrenceIndex,
  type PlanOccurrenceView,
} from "@/lib/calendar/plan-occurrence-selection"
import {
  type PlanAppearanceCursor,
  planAppearanceCursorSchema,
  planAppearanceQuerySchema,
} from "@/schemas/plan-appearance-query"
import { planSchema } from "@/schemas/plan-item"
import { userIdSchema } from "@/schemas/primitives"
import type { Plan } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"

const plansSchema = z.array(planSchema).max(10000)
export interface PlanAppearancePage {
  views: PlanOccurrenceView[]
  issues: OccurrenceScheduleIssue[]
  nextCursor: PlanAppearanceCursor | null
}
function dayDistance(first: string, last: string): number {
  return (
    (civilDateToUtc(last).getTime() - civilDateToUtc(first).getTime()) /
    86400000
  )
}
function lookbackStart(parent: Plan, visibleStart: string): string {
  const schedule = parent.schedule
  const duration =
    schedule.mode === "all_day"
      ? dayDistance(schedule.startDate, schedule.endDateExclusive) - 1
      : dayDistance(
          schedule.localStart.slice(0, 10),
          (schedule.localEnd ?? schedule.localStart).slice(0, 10)
        )
  const availableDays = dayDistance("0001-01-01", visibleStart)
  return addCivilDays(visibleStart, -Math.min(duration, availableDays))
}
function intersects(
  view: PlanOccurrenceView,
  startDate: string,
  endDate: string
): boolean {
  const schedule = view.occurrence.schedule
  const start =
    schedule.mode === "all_day"
      ? schedule.startDate
      : schedule.localStart.slice(0, 10)
  const due =
    schedule.mode === "all_day"
      ? addCivilDays(schedule.endDateExclusive, -1)
      : (schedule.localEnd ?? schedule.localStart).slice(0, 10)
  return start <= endDate && due >= startDate
}

// A call reads exception pagination and at most one bounded generation page.
export function readPlanAppearancePage(
  plansInput: readonly Plan[],
  exceptionsInput: readonly PlanOccurrence[],
  userId: string,
  queryInput: z.input<typeof planAppearanceQuerySchema>,
  cursorInput: PlanAppearanceCursor | null = null
): PlanAppearancePage {
  const actor = userIdSchema.parse(userId)
  const query = planAppearanceQuerySchema.parse(queryInput)
  const cursor = planAppearanceCursorSchema.nullable().parse(cursorInput)
  const plans = plansSchema.parse(plansInput)
  const index = createPlanOccurrenceIndex(plans, exceptionsInput, actor)
  const parents = new Map(
    plans
      .filter(
        (parent) =>
          parent.ownerId === actor && parent.recurrence && !parent.deletedAt
      )
      .map((parent) => [parent.id, parent])
  )
  let seriesId = index.seriesIds[0]
  let afterDate: string | null = null
  const views: PlanOccurrenceView[] = []
  if (cursor?.phase === "generated") {
    if (!parents.has(cursor.seriesId))
      throw new Error("Plan appearance cursor references an unavailable series")
    seriesId = cursor.seriesId
    afterDate = cursor.afterDate
  } else {
    const page = index.exceptionsPage({
      ...query,
      after: cursor?.after ?? null,
    })
    views.push(...page.views)
    if (page.nextCursor)
      return {
        views,
        issues: [],
        nextCursor: { phase: "exceptions", after: page.nextCursor },
      }
    if (!seriesId) return { views, issues: [], nextCursor: null }
    if (views.length === query.limit)
      return {
        views,
        issues: [],
        nextCursor: { phase: "generated", seriesId, afterDate: null },
      }
  }
  if (!seriesId) return { views, issues: [], nextCursor: null }
  const parent = parents.get(seriesId)
  if (!parent) throw new Error("Prepared plan appearance series is unavailable")
  const page = index.generatedPage(seriesId, {
    startDate: lookbackStart(parent, query.startDate),
    endDate: query.endDate,
    limit: query.limit - views.length,
    includeCompleted: query.includeCompleted,
    afterDate,
  })
  views.push(
    ...page.views.filter((view) =>
      intersects(view, query.startDate, query.endDate)
    )
  )
  if (page.nextAfter)
    return {
      views,
      issues: page.issues,
      nextCursor: { phase: "generated", seriesId, afterDate: page.nextAfter },
    }
  const nextSeriesId = index.seriesIds[index.seriesIds.indexOf(seriesId) + 1]
  return {
    views,
    issues: page.issues,
    nextCursor: nextSeriesId
      ? { phase: "generated", seriesId: nextSeriesId, afterDate: null }
      : null,
  }
}
