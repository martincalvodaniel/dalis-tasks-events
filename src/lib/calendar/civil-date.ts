import { civilDateSchema, timeZoneSchema } from "@/schemas/primitives"

export type Clock = () => Date

export function civilDateInTimeZone(instant: Date, timeZone: string): string {
  if (!Number.isFinite(instant.getTime())) {
    throw new RangeError("Invalid instant")
  }
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timeZoneSchema.parse(timeZone),
    calendar: "iso8601",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    era: "short",
  }).formatToParts(instant)
  const readPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value
  if (readPart("era") !== "AD") {
    throw new RangeError("Instant falls outside the supported civil calendar")
  }
  return civilDateSchema.parse(
    `${readPart("year")?.padStart(4, "0")}-${readPart("month")}-${readPart("day")}`
  )
}

export function todayInTimeZone(
  timeZone: string,
  clock: Clock = () => new Date()
): string {
  return civilDateInTimeZone(clock(), timeZone)
}

// UTC is only an arithmetic carrier here, never a task's assigned time zone.
export function civilDateToUtc(date: string): Date {
  const [year, month, day] = civilDateSchema.parse(date).split("-").map(Number)
  const result = new Date(0)
  result.setUTCFullYear(year, month - 1, day)
  result.setUTCHours(0, 0, 0, 0)
  return result
}

export function addCivilDays(date: string, days: number): string {
  if (!Number.isSafeInteger(days)) {
    throw new RangeError("Day offset must be a safe integer")
  }
  const result = civilDateToUtc(date)
  result.setUTCDate(result.getUTCDate() + days)
  if (
    !Number.isFinite(result.getTime()) ||
    result.getUTCFullYear() < 1 ||
    result.getUTCFullYear() > 9999
  ) {
    throw new RangeError("Date falls outside the supported civil calendar")
  }
  return civilDateSchema.parse(result.toISOString().slice(0, 10))
}
