import { resolveZonedInstant } from "@/lib/calendar/zoned-time"
import { eventScheduleSchema } from "@/schemas/calendar-item"
import type { CalendarEvent } from "@/types/calendar-item"

export function resolveEventSchedule(input: CalendarEvent["schedule"]) {
  const schedule = eventScheduleSchema.parse(input)
  if (schedule.mode === "all_day") return schedule
  const start = resolveZonedInstant(schedule.localStart, schedule.timeZone)
  const end = schedule.localEnd
    ? resolveZonedInstant(schedule.localEnd, schedule.timeZone)
    : null
  if (end !== null && end <= start)
    throw new RangeError("Event duration must be positive in exact time")
  return {
    mode: "timed" as const,
    start,
    end,
    durationMilliseconds: end === null ? null : end - start,
  }
}
