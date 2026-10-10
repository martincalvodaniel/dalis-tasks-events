import type { z } from "zod"
import { resolveEventSchedule } from "@/lib/calendar/event-time"
import { projectOccurrenceSchedule } from "@/lib/calendar/occurrence-schedule"
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
      schedule = projectOccurrenceSchedule(series.schedule, date)
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
