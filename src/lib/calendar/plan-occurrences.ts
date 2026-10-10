import type { z } from "zod"
import { resolveEventSchedule } from "@/lib/calendar/event-time"
import { projectOccurrenceSchedule } from "@/lib/calendar/occurrence-schedule"
import type { OccurrenceScheduleIssue } from "@/lib/calendar/occurrences"
import { recurrenceDatesPage } from "@/lib/calendar/recurrence"
import { ZonedTimeError } from "@/lib/calendar/zoned-time"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import { recurrenceQuerySchema } from "@/schemas/recurrence-query"
import type { Plan } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"

export interface PlanOccurrencePage {
  occurrences: PlanOccurrence[]
  issues: OccurrenceScheduleIssue[]
  nextAfter: string | null
}

// The query covers original starts in the series zone; visibility is a separate projection.
export function planOccurrencesPage(
  input: Plan,
  queryInput: z.input<typeof recurrenceQuerySchema>
): PlanOccurrencePage {
  const series = planSchema.parse(input)
  const query = recurrenceQuerySchema.parse(queryInput)
  if (!series.recurrence)
    throw new Error("Plan occurrence generation requires a recurring series")
  if (series.deletedAt) return { occurrences: [], issues: [], nextAfter: null }
  const page = recurrenceDatesPage(series.recurrence, query)
  const occurrences: PlanOccurrence[] = []
  const issues: OccurrenceScheduleIssue[] = []
  for (const date of page.dates) {
    const slotKey =
      series.schedule.mode === "timed"
        ? `${date}${series.schedule.localStart.slice(10)}`
        : date
    const identity = {
      id: `${series.id}:${slotKey}`,
      seriesId: series.id,
      slotKey,
    }
    let schedule: Plan["schedule"]
    try {
      schedule = projectOccurrenceSchedule(series.schedule, date)
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
      issues.push({ ...identity, reason: "out_of_range" })
      continue
    }
    try {
      resolveEventSchedule(schedule)
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
      issues.push({
        ...identity,
        reason:
          error instanceof ZonedTimeError ? error.reason : "invalid_duration",
      })
      continue
    }
    occurrences.push(
      planOccurrenceSchema.parse({
        ...identity,
        kind: "plan",
        schedule,
        status: "not_started",
        completedAt: null,
        checklist: series.checklist.map((entry) => ({
          ...entry,
          completed: false,
        })),
        cancelled: false,
        revision: 0,
        createdAt: series.createdAt,
        updatedAt: series.createdAt,
        deletedAt: null,
      })
    )
  }
  return { occurrences, issues, nextAfter: page.nextAfter }
}
