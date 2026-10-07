import { addCivilDays, civilDateToUtc } from "@/lib/calendar/civil-date"
import { resolveEventSchedule } from "@/lib/calendar/event-time"
import type { CalendarEvent } from "@/types/calendar-item"

const civilFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeZone: "UTC",
})

export function createEventSummary(timeZone: string) {
  const timedFormatter = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  })
  return (event: CalendarEvent): string => {
    const schedule = resolveEventSchedule(event.schedule)
    if (schedule.mode === "all_day") {
      const first = civilFormatter.format(civilDateToUtc(schedule.startDate))
      const lastDate = addCivilDays(schedule.endDateExclusive, -1)
      return `${first}${lastDate !== schedule.startDate ? ` – ${civilFormatter.format(civilDateToUtc(lastDate))}` : ""} · Todo el día`
    }
    return `${timedFormatter.format(schedule.start)}${schedule.end !== null ? ` – ${timedFormatter.format(schedule.end)}` : ""}`
  }
}
