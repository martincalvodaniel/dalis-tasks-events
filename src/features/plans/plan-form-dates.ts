import { addCivilDays, civilDateToUtc } from "@/lib/calendar/civil-date"
import { civilDateSchema } from "@/schemas/primitives"

// Preserve the visible civil-day span. Timed fields retain their separately edited hours.
export function shiftPlanEndDate(
  previousStart: string,
  currentEnd: string,
  nextStart: string,
  maximum = "9999-12-31"
): string {
  if (
    !currentEnd ||
    ![previousStart, currentEnd, nextStart].every(
      (value) => civilDateSchema.safeParse(value).success
    ) ||
    nextStart > maximum
  )
    return currentEnd
  const days = Math.max(
    0,
    Math.round(
      (civilDateToUtc(currentEnd).getTime() -
        civilDateToUtc(previousStart).getTime()) /
        86400000
    )
  )
  try {
    const end = addCivilDays(nextStart, days)
    return end > maximum ? maximum : end
  } catch {
    return maximum
  }
}
