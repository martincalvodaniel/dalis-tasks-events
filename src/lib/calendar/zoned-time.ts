import { civilDateToUtc } from "@/lib/calendar/civil-date"
import { localDateTimeSchema, timeZoneSchema } from "@/schemas/primitives"

export class ZonedTimeError extends RangeError {
  constructor(public readonly reason: "nonexistent" | "ambiguous") {
    super(`Local date-time is ${reason} in its time zone`)
    this.name = "ZonedTimeError"
  }
}

function formatterFor(timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timeZoneSchema.parse(timeZone),
    calendar: "iso8601",
    numberingSystem: "latn",
    era: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
}

function civilPartsEpoch(formatter: Intl.DateTimeFormat, instant: number) {
  const parts = formatter.formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value
  const year = Number(read("year"))
  const date = new Date(0)
  date.setUTCFullYear(
    read("era") === "BC" ? 1 - year : year,
    Number(read("month")) - 1,
    Number(read("day"))
  )
  date.setUTCHours(
    Number(read("hour")),
    Number(read("minute")),
    Number(read("second")),
    0
  )
  if (!Number.isFinite(date.getTime()))
    throw new RangeError("Invalid time-zone formatter parts")
  return date.getTime()
}

function possibleInstantsWithFormatter(
  localDateTime: string,
  formatter: Intl.DateTimeFormat
): number[] {
  const local = localDateTimeSchema.parse(localDateTime)
  const carrier = civilDateToUtc(local.slice(0, 10))
  carrier.setUTCHours(
    Number(local.slice(11, 13)),
    Number(local.slice(14, 16)),
    0,
    0
  )
  const wallTime = carrier.getTime()
  // Nearby offsets are candidates, never a disambiguation policy. Every result must round-trip exactly.
  const offsets = new Set(
    [-86400000, 0, 86400000].map((delta) => {
      const sample = wallTime + delta
      return civilPartsEpoch(formatter, sample) - sample
    })
  )
  return [...offsets]
    .map((offset) => wallTime - offset)
    .filter((candidate) => civilPartsEpoch(formatter, candidate) === wallTime)
    .sort((a, b) => a - b)
}

export function createZonedTimeResolver(timeZone: string) {
  const formatter = formatterFor(timeZone)
  return (localDateTime: string) =>
    possibleInstantsWithFormatter(localDateTime, formatter)
}

export function possibleZonedInstants(
  localDateTime: string,
  timeZone: string
): number[] {
  return createZonedTimeResolver(timeZone)(localDateTime)
}

export function resolveZonedInstant(
  localDateTime: string,
  timeZone: string
): number {
  const candidates = possibleZonedInstants(localDateTime, timeZone)
  if (!candidates.length) throw new ZonedTimeError("nonexistent")
  if (candidates.length > 1) throw new ZonedTimeError("ambiguous")
  return candidates[0]
}
