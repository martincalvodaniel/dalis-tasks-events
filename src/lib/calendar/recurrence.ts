import type { z } from "zod"
import { civilDateToUtc } from "@/lib/calendar/civil-date"
import { recurrenceSchema } from "@/schemas/recurrence"
import { recurrenceQuerySchema } from "@/schemas/recurrence-query"
import type { RecurrenceRule } from "@/types/calendar-item"

const dayMilliseconds = 86400000
interface Candidate {
  date: string
  ordinal: number
}
export interface RecurrenceDatePage {
  dates: string[]
  nextAfter: string | null
}

function dayNumber(date: string): number {
  return civilDateToUtc(date).getTime() / dayMilliseconds
}
function formatDay(day: number): string {
  return new Date(day * dayMilliseconds).toISOString().slice(0, 10)
}
function daysInMonth(year: number, month: number): number {
  if (month === 2)
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}
function monthDate(monthIndex: number, day: number): string | null {
  const year = Math.floor(monthIndex / 12) + 1
  const month = (monthIndex % 12) + 1
  if (day > daysInMonth(year, month)) return null
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}
function greatestCommonDivisor(left: number, right: number): number {
  while (right) [left, right] = [right, left % right]
  return left
}

// Gregorian validity repeats every 400 years; count skipped dates without scanning history.
function validCountBefore(
  periodLength: number,
  valid: (period: number) => boolean
) {
  const prefix = [0]
  for (let period = 0; period < periodLength; period++)
    prefix.push(prefix[period] + Number(valid(period)))
  return (period: number) =>
    Math.floor(period / periodLength) * prefix[periodLength] +
    prefix[period % periodLength]
}

function* daily(
  rule: RecurrenceRule,
  start: string,
  end: string
): Generator<Candidate> {
  const anchor = dayNumber(rule.anchorDate)
  const last = dayNumber(end)
  let period = Math.max(
    0,
    Math.ceil((dayNumber(start) - anchor) / rule.interval)
  )
  for (
    let day = anchor + period * rule.interval;
    day <= last;
    day += rule.interval, period++
  )
    yield { date: formatDay(day), ordinal: period + 1 }
}
function* weekly(
  rule: Extract<RecurrenceRule, { frequency: "weekly" }>,
  start: string,
  end: string
): Generator<Candidate> {
  const anchor = dayNumber(rule.anchorDate)
  const anchorWeekday = (civilDateToUtc(rule.anchorDate).getUTCDay() + 6) % 7
  const weekStart = anchor - anchorWeekday
  const offsets = rule.weekdays
    .map((day) => (day + 6) % 7)
    .sort((left, right) => left - right)
  const firstOffsets = offsets.filter((offset) => offset >= anchorWeekday)
  const first = dayNumber(start)
  const last = dayNumber(end)
  const step = 7 * rule.interval
  const firstPeriod = Math.max(0, Math.floor((first - weekStart) / step))
  for (let period = firstPeriod; weekStart + period * step <= last; period++) {
    const activeOffsets = period === 0 ? firstOffsets : offsets
    for (const [index, offset] of activeOffsets.entries()) {
      const day = weekStart + period * step + offset
      if (day < first || day > last) continue
      yield {
        date: formatDay(day),
        ordinal:
          period === 0
            ? index + 1
            : firstOffsets.length + (period - 1) * offsets.length + index + 1,
      }
    }
  }
}
function* monthly(
  rule: RecurrenceRule,
  start: string,
  end: string
): Generator<Candidate> {
  const [year, month, day] = rule.anchorDate.split("-").map(Number)
  const anchorMonth = (year - 1) * 12 + month - 1
  const startMonth =
    (Number(start.slice(0, 4)) - 1) * 12 + Number(start.slice(5, 7)) - 1
  const lastMonth =
    (Number(end.slice(0, 4)) - 1) * 12 + Number(end.slice(5, 7)) - 1
  const countBefore =
    day <= 28
      ? (period: number) => period
      : validCountBefore(
          4800 / greatestCommonDivisor(4800, rule.interval),
          (period) => {
            const index = (anchorMonth + period * rule.interval) % 4800
            return (
              day <= daysInMonth(Math.floor(index / 12) + 1, (index % 12) + 1)
            )
          }
        )
  const firstPeriod = Math.max(
    0,
    Math.ceil((startMonth - anchorMonth) / rule.interval)
  )
  for (
    let period = firstPeriod;
    anchorMonth + period * rule.interval <= lastMonth;
    period++
  ) {
    const date = monthDate(anchorMonth + period * rule.interval, day)
    if (date && date >= start && date <= end)
      yield { date, ordinal: countBefore(period) + 1 }
  }
}
function* yearly(
  rule: RecurrenceRule,
  start: string,
  end: string
): Generator<Candidate> {
  const [year, month, day] = rule.anchorDate.split("-").map(Number)
  const lastYear = Number(end.slice(0, 4))
  const countBefore =
    month !== 2 || day !== 29
      ? (period: number) => period
      : validCountBefore(
          400 / greatestCommonDivisor(400, rule.interval),
          (period) =>
            day <=
            daysInMonth(((year - 1 + period * rule.interval) % 400) + 1, month)
        )
  const firstPeriod = Math.max(
    0,
    Math.ceil((Number(start.slice(0, 4)) - year) / rule.interval)
  )
  for (
    let period = firstPeriod;
    year + period * rule.interval <= lastYear;
    period++
  ) {
    const date = monthDate(
      (year - 1 + period * rule.interval) * 12 + month - 1,
      day
    )
    if (date && date >= start && date <= end)
      yield { date, ordinal: countBefore(period) + 1 }
  }
}

export function recurrenceDatesPage(
  input: RecurrenceRule,
  queryInput: z.input<typeof recurrenceQuerySchema>
): RecurrenceDatePage {
  const rule = recurrenceSchema.parse(input)
  const query = recurrenceQuerySchema.parse(queryInput)
  const start = query.afterDate ?? query.startDate
  const end =
    rule.end.type === "until" && rule.end.date < query.endDate
      ? rule.end.date
      : query.endDate
  const candidates =
    rule.frequency === "daily"
      ? daily(rule, start, end)
      : rule.frequency === "weekly"
        ? weekly(rule, start, end)
        : rule.frequency === "monthly"
          ? monthly(rule, start, end)
          : yearly(rule, start, end)
  const dates: string[] = []
  for (const candidate of candidates) {
    if (rule.end.type === "count" && candidate.ordinal > rule.end.count) break
    if (query.afterDate && candidate.date <= query.afterDate) continue
    if (dates.length === query.limit)
      return { dates, nextAfter: dates.at(-1) ?? null }
    dates.push(candidate.date)
  }
  return { dates, nextAfter: null }
}
