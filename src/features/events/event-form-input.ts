import { addCivilDays } from "@/lib/calendar/civil-date"
import { eventInputSchema } from "@/schemas/event-input"

export function parseEventForm(fields: FormData) {
  const allDay = fields.get("allDay") === "on"
  let endDateExclusive: unknown = fields.get("lastDate")
  if (allDay && typeof endDateExclusive === "string") {
    try {
      endDateExclusive = addCivilDays(endDateExclusive, 1)
    } catch {
      endDateExclusive = null
    }
  }
  function localDateTime(name: string) {
    if (!fields.has(`${name}Date`)) return fields.get(name)
    const date = fields.get(`${name}Date`)
    const time = fields.get(`${name}Time`)
    if (!date && !time) return null
    return `${date ?? ""}T${time ?? ""}`
  }
  return eventInputSchema.safeParse({
    kind: "event",
    title: fields.get("title"),
    description: fields.get("description"),
    recurrence: null,
    schedule: allDay
      ? {
          mode: "all_day",
          startDate: fields.get("startDate"),
          endDateExclusive,
        }
      : {
          mode: "timed",
          localStart: localDateTime("localStart"),
          localEnd: localDateTime("localEnd") || null,
          timeZone: fields.get("timeZone"),
        },
  })
}
