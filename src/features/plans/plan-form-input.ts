import { addCivilDays } from "@/lib/calendar/civil-date"
import { planInputSchema } from "@/schemas/plan-input"
import type { ChecklistEntry } from "@/types/calendar-item"

export function parsePlanForm(fields: FormData, checklist: ChecklistEntry[]) {
  const allDay = fields.get("allDay") === "on"
  const startDate = fields.get("localStartDate")
  let endDateExclusive: unknown = fields.get("localEndDate") || startDate
  if (allDay && typeof endDateExclusive === "string") {
    try {
      endDateExclusive = addCivilDays(endDateExclusive, 1)
    } catch {
      endDateExclusive = null
    }
  }
  function localDateTime(name: string) {
    const date = fields.get(`${name}Date`)
    const time = fields.get(`${name}Time`)
    if (!date && !time) return null
    return `${date ?? ""}T${time ?? ""}`
  }
  const frequency = fields.get("frequency")
  const endType = fields.get("recurrenceEnd")
  const recurrence =
    frequency === "none"
      ? null
      : {
          frequency,
          anchorDate: startDate,
          timeZone: fields.get("timeZone"),
          interval: Number(fields.get("interval")),
          end:
            endType === "until"
              ? { type: "until", date: fields.get("untilDate") }
              : endType === "count"
                ? { type: "count", count: Number(fields.get("count")) }
                : { type: endType },
          ...(frequency === "weekly"
            ? { weekdays: fields.getAll("weekdays").map(Number) }
            : {}),
        }
  return planInputSchema.safeParse({
    kind: "plan",
    variant: fields.get("variant"),
    title: fields.get("title"),
    description: fields.get("description"),
    status: fields.get("status"),
    checklist,
    recurrence,
    schedule: allDay
      ? { mode: "all_day", startDate, endDateExclusive }
      : {
          mode: "timed",
          localStart: localDateTime("localStart"),
          localEnd: localDateTime("localEnd"),
          timeZone: fields.get("timeZone"),
        },
  })
}
