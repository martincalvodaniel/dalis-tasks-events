import { addCivilDays, civilDateToUtc } from "@/lib/calendar/civil-date"
import { civilDateSchema } from "@/schemas/primitives"

export interface CivilDateRange {
  start: string
  endExclusive: string
}

export function monthRange(date: string): CivilDateRange {
  const validDate = civilDateSchema.parse(date)
  const start = `${validDate.slice(0, 7)}-01`
  const first = civilDateToUtc(start)
  const dayCount = new Date(first.getTime())
  dayCount.setUTCMonth(dayCount.getUTCMonth() + 1, 0)
  return {
    start,
    endExclusive: addCivilDays(start, dayCount.getUTCDate()),
  }
}

export function monthGridRange(date: string): CivilDateRange {
  const month = monthRange(date)
  const mondayOffset = (civilDateToUtc(month.start).getUTCDay() + 6) % 7
  const lastDay = addCivilDays(month.endExclusive, -1)
  const trailingDays = 6 - ((civilDateToUtc(lastDay).getUTCDay() + 6) % 7)
  return {
    start: addCivilDays(month.start, -mondayOffset),
    endExclusive: addCivilDays(month.endExclusive, trailingDays),
  }
}

export function datesInRange(range: CivilDateRange, limit = 366): string[] {
  const start = civilDateSchema.parse(range.start)
  const end = civilDateSchema.parse(range.endExclusive)
  if (end < start) throw new RangeError("Range end precedes its start")
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10000) {
    throw new RangeError("Invalid date range limit")
  }
  const dates: string[] = []
  for (let date = start; date < end; date = addCivilDays(date, 1)) {
    if (dates.length === limit) throw new RangeError("Date range exceeds limit")
    dates.push(date)
  }
  return dates
}
