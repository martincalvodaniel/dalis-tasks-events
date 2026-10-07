import { ZodError } from "zod"
import {
  addCivilDays,
  civilDateInTimeZone,
  civilDateToUtc,
} from "@/lib/calendar/civil-date"
import { resolveEventSchedule } from "@/lib/calendar/event-time"
import {
  possibleZonedInstants,
  ZonedTimeError,
} from "@/lib/calendar/zoned-time"
import { civilDateSchema, timeZoneSchema } from "@/schemas/primitives"
import type { CalendarEvent } from "@/types/calendar-item"

export interface EventCalendarIssue {
  event: CalendarEvent
  reason: "ambiguous" | "nonexistent" | "invalid"
}
interface ProjectedEvent {
  event: CalendarEvent
  firstDate: string
  startDate: string
  endDate: string
  lastDate: string
  start: number | null
  end: number | null
}

function projectEvent(event: CalendarEvent, timeZone: string): ProjectedEvent {
  const schedule = resolveEventSchedule(event.schedule)
  if (schedule.mode === "all_day")
    return {
      event,
      firstDate: schedule.startDate,
      startDate: schedule.startDate,
      endDate: addCivilDays(schedule.endDateExclusive, -1),
      lastDate: addCivilDays(schedule.endDateExclusive, -1),
      start: null,
      end: null,
    }
  const startDate = civilDateInTimeZone(new Date(schedule.start), timeZone)
  const endDate = civilDateInTimeZone(
    new Date(schedule.end === null ? schedule.start : schedule.end - 1),
    timeZone
  )
  const minimum = civilDateToUtc("0001-01-01").getTime()
  const maximum = civilDateToUtc("9999-12-31").getTime() + 86400000 - 1
  return {
    event,
    startDate,
    endDate,
    // A civil date may briefly reverse at an offset transition; endpoints alone are not a safe envelope.
    firstDate: civilDateInTimeZone(
      new Date(Math.max(minimum, schedule.start - 86400000)),
      "UTC"
    ),
    lastDate: civilDateInTimeZone(
      new Date(Math.min(maximum, (schedule.end ?? schedule.start) + 86400000)),
      "UTC"
    ),
    start: schedule.start,
    end: schedule.end,
  }
}

function overlapsDay(
  event: ProjectedEvent,
  date: string,
  timeZone: string,
  candidates: Map<string, number[]>
): boolean {
  if (event.firstDate > date || event.lastDate < date) return false
  if (
    event.start === null ||
    event.startDate === date ||
    event.endDate === date
  )
    return true
  if (event.end === null) return false
  const start = event.start
  // Probe noon first. Missing civil dates and unusual partial days fall back to a bounded minute scan.
  for (let probe = 0; probe < 1440; probe++) {
    const minute = probe === 0 ? 720 : probe <= 720 ? probe - 1 : probe
    const local = `${date}T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
    let instants = candidates.get(local)
    if (!instants) {
      instants = possibleZonedInstants(local, timeZone)
      candidates.set(local, instants)
    }
    if (
      instants.some(
        (instant) =>
          instant >= start && (event.end === null || instant < event.end)
      )
    )
      return true
  }
  return false
}

export function selectCalendarEvents(
  events: readonly CalendarEvent[],
  range: { startDate: string; endDate: string },
  timeZone: string
) {
  const zone = timeZoneSchema.parse(timeZone)
  const startDate = civilDateSchema.parse(range.startDate)
  const endDate = civilDateSchema.parse(range.endDate)
  const days =
    (civilDateToUtc(endDate).getTime() - civilDateToUtc(startDate).getTime()) /
      86400000 +
    1
  if (days < 1 || days > 62)
    throw new RangeError(
      "Event calendar queries require a range of 1 to 62 civil days"
    )
  const issues: EventCalendarIssue[] = []
  const selected: ProjectedEvent[] = []
  const candidates = new Map<string, number[]>()
  for (const event of events) {
    if (event.deletedAt || event.recurrence) continue
    let projected: ProjectedEvent
    try {
      projected = projectEvent(event, zone)
    } catch (error) {
      if (!(error instanceof RangeError) && !(error instanceof ZodError))
        throw error
      issues.push({
        event,
        reason: error instanceof ZonedTimeError ? error.reason : "invalid",
      })
      continue
    }
    if (projected.firstDate > endDate || projected.lastDate < startDate)
      continue
    // Prefer a known included endpoint for range queries; probe dates only when neither endpoint lies in the view.
    if (
      (projected.startDate >= startDate && projected.startDate <= endDate) ||
      (projected.endDate >= startDate && projected.endDate <= endDate)
    ) {
      selected.push(projected)
      continue
    }
    let date = projected.firstDate > startDate ? projected.firstDate : startDate
    const last = projected.lastDate < endDate ? projected.lastDate : endDate
    while (date <= last) {
      if (overlapsDay(projected, date, zone, candidates)) {
        selected.push(projected)
        break
      }
      if (date === last) break
      date = addCivilDays(date, 1)
    }
  }
  const compareId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  selected.sort((a, b) =>
    a.start === null && b.start !== null
      ? -1
      : b.start === null && a.start !== null
        ? 1
        : (a.start ?? 0) - (b.start ?? 0) || compareId(a.event.id, b.event.id)
  )
  issues.sort((a, b) => compareId(a.event.id, b.event.id))
  return { events: selected.map(({ event }) => event), issues }
}
