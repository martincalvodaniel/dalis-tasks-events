import { addCivilDays, civilDateToUtc } from "@/lib/calendar/civil-date"
import type { CalendarEvent } from "@/types/calendar-item"

function dayDistance(first: string, last: string): number {
  return (
    (civilDateToUtc(last).getTime() - civilDateToUtc(first).getTime()) /
    86400000
  )
}

// Keep civil endpoints rather than adding elapsed milliseconds across a DST boundary.
export function projectOccurrenceSchedule(
  schedule: CalendarEvent["schedule"],
  date: string
): CalendarEvent["schedule"] {
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
