import type { z } from "zod"
import { addCivilDays, civilDateToUtc } from "@/lib/calendar/civil-date"
import { resolveEventSchedule } from "@/lib/calendar/event-time"
import { recurrenceDatesPage } from "@/lib/calendar/recurrence"
import { ZonedTimeError } from "@/lib/calendar/zoned-time"
import { eventSchema, taskSchema } from "@/schemas/calendar-item"
import { itemOccurrenceSchema } from "@/schemas/occurrence"
import { recurrenceQuerySchema } from "@/schemas/recurrence-query"
import type { CalendarEvent, ItemOccurrence, Task } from "@/types/calendar-item"

export interface OccurrenceScheduleIssue {
  id: string
  seriesId: string
  slotKey: string
  reason: "ambiguous" | "nonexistent" | "invalid_duration" | "out_of_range"
}
export interface OccurrencePage {
  occurrences: ItemOccurrence[]
  issues: OccurrenceScheduleIssue[]
  nextAfter: string | null
}

function dayDistance(first: string, last: string): number {
  return (
    (civilDateToUtc(last).getTime() - civilDateToUtc(first).getTime()) /
    86400000
  )
}
function projectEventSchedule(
  event: CalendarEvent,
  date: string
): CalendarEvent["schedule"] {
  const schedule = event.schedule
  if (schedule.mode === "all_day")
    return {
      mode: "all_day",
      startDate: date,
      endDateExclusive: addCivilDays(
        date,
        dayDistance(schedule.startDate, schedule.endDateExclusive)
      ),
    }
  const dayOffset = dayDistance(schedule.localStart.slice(0, 10), date)
  return {
    mode: "timed",
    localStart: `${date}${schedule.localStart.slice(10)}`,
    localEnd: schedule.localEnd
      ? `${addCivilDays(schedule.localEnd.slice(0, 10), dayOffset)}${schedule.localEnd.slice(10)}`
      : null,
    timeZone: schedule.timeZone,
  }
}

// Query dates are original starts in the series zone, not account-calendar visibility.
export function occurrencesPage(
  input: Task | CalendarEvent,
  queryInput: z.input<typeof recurrenceQuerySchema>
): OccurrencePage {
  const series =
    input.kind === "task" ? taskSchema.parse(input) : eventSchema.parse(input)
  const query = recurrenceQuerySchema.parse(queryInput)
  if (!series.recurrence)
    throw new Error("Occurrence generation requires a recurring series")
  if (series.deletedAt) return { occurrences: [], issues: [], nextAfter: null }
  const page = recurrenceDatesPage(series.recurrence, query)
  const occurrences: ItemOccurrence[] = []
  const issues: OccurrenceScheduleIssue[] = []
  for (const date of page.dates) {
    const slotKey =
      series.kind === "event" && series.schedule.mode === "timed"
        ? `${date}${series.schedule.localStart.slice(10)}`
        : date
    const base = {
      id: `${series.id}:${slotKey}`,
      seriesId: series.id,
      slotKey,
      cancelled: false,
      revision: 0,
      createdAt: series.createdAt,
      updatedAt: series.createdAt,
      deletedAt: null,
    }
    if (series.kind === "task") {
      occurrences.push(
        itemOccurrenceSchema.parse({
          ...base,
          kind: "task",
          scheduledDate: date,
          status: "not_started",
          completedAt: null,
          checklist: series.checklist.map((entry) => ({
            ...entry,
            completed: false,
          })),
        })
      )
      continue
    }
    let schedule: CalendarEvent["schedule"]
    try {
      schedule = projectEventSchedule(series, date)
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
      issues.push({
        id: base.id,
        seriesId: series.id,
        slotKey,
        reason: "out_of_range",
      })
      continue
    }
    try {
      resolveEventSchedule(schedule)
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
      issues.push({
        id: base.id,
        seriesId: series.id,
        slotKey,
        reason:
          error instanceof ZonedTimeError ? error.reason : "invalid_duration",
      })
      continue
    }
    occurrences.push(
      itemOccurrenceSchema.parse({ ...base, kind: "event", schedule })
    )
  }
  return { occurrences, issues, nextAfter: page.nextAfter }
}
