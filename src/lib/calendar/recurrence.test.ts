import { expect, test } from "bun:test"
import { recurrenceDatesPage } from "@/lib/calendar/recurrence"
import type { RecurrenceRule } from "@/types/calendar-item"

const daily = (
  overrides: Partial<Extract<RecurrenceRule, { frequency: "daily" }>> = {}
): RecurrenceRule => ({
  frequency: "daily",
  anchorDate: "2026-10-07",
  timeZone: "Europe/Madrid",
  interval: 1,
  end: { type: "never" },
  ...overrides,
})
const monthly = (anchorDate = "2026-01-31", count = 3): RecurrenceRule => ({
  ...daily(),
  frequency: "monthly",
  anchorDate,
  end: { type: "count", count },
})
const query = (startDate: string, endDate: string, limit = 100) => ({
  startDate,
  endDate,
  limit,
})
const dates = (rule: RecurrenceRule, start: string, end: string) =>
  recurrenceDatesPage(rule, query(start, end)).dates

test("daily recurrence keeps cadence and global count across remote ranges and exclusive cursors", () => {
  const rule = daily({ interval: 3, end: { type: "count", count: 4 } })
  expect(dates(rule, "2026-10-01", "2026-10-31")).toEqual([
    "2026-10-07",
    "2026-10-10",
    "2026-10-13",
    "2026-10-16",
  ])
  expect(
    recurrenceDatesPage(rule, query("2026-10-11", "2026-10-31", 1))
  ).toEqual({ dates: ["2026-10-13"], nextAfter: "2026-10-13" })
  expect(
    recurrenceDatesPage(rule, {
      ...query("2026-10-11", "2026-10-31", 1),
      afterDate: "2026-10-13",
    })
  ).toEqual({ dates: ["2026-10-16"], nextAfter: null })
  expect(dates(rule, "2026-10-17", "9999-12-31")).toEqual([])
  expect(
    dates(
      daily({ end: { type: "until", date: "2026-10-08" } }),
      "2026-10-07",
      "2026-10-31"
    )
  ).toEqual(["2026-10-07", "2026-10-08"])
})

test("weekly recurrence anchors Monday weeks and excludes earlier weekdays from the first count", () => {
  const rule: RecurrenceRule = {
    ...daily(),
    frequency: "weekly",
    interval: 2,
    weekdays: [0, 1, 3],
    end: { type: "count", count: 5 },
  }
  expect(dates(rule, "2026-10-01", "2026-11-30")).toEqual([
    "2026-10-07",
    "2026-10-11",
    "2026-10-19",
    "2026-10-21",
    "2026-10-25",
  ])
  expect(dates(rule, "2026-10-20", "2026-11-30")).toEqual([
    "2026-10-21",
    "2026-10-25",
  ])
  expect(
    dates(
      { ...rule, weekdays: [1], end: { type: "count", count: 1 } },
      "2026-10-01",
      "2026-11-30"
    )
  ).toEqual(["2026-10-19"])
  expect(
    dates(
      { ...rule, anchorDate: "0001-01-01", interval: 1, weekdays: [0, 1] },
      "0001-01-01",
      "0001-01-07"
    )
  ).toEqual(["0001-01-01", "0001-01-07"])
  expect(rule.weekdays).toEqual([0, 1, 3])
})

test("monthly recurrence skips missing anchor days without consuming the global count", () => {
  const rule = monthly()
  expect(dates(rule, "2026-01-01", "2026-12-31")).toEqual([
    "2026-01-31",
    "2026-03-31",
    "2026-05-31",
  ])
  expect(dates(rule, "2026-04-01", "2026-12-31")).toEqual(["2026-05-31"])
  expect(dates({ ...rule, interval: 2 }, "2026-02-01", "2026-12-31")).toEqual([
    "2026-03-31",
    "2026-05-31",
  ])
  expect(dates(monthly("2023-01-29", 3), "2023-01-01", "2023-05-31")).toEqual([
    "2023-01-29",
    "2023-03-29",
    "2023-04-29",
  ])
  expect(dates(monthly("2024-01-29", 3), "2024-01-01", "2024-05-31")).toEqual([
    "2024-01-29",
    "2024-02-29",
    "2024-03-29",
  ])
  expect(
    dates(
      { ...monthly("2026-01-31"), end: { type: "until", date: "2026-04-30" } },
      "2026-01-01",
      "2026-12-31"
    )
  ).toEqual(["2026-01-31", "2026-03-31"])
})

test("annual leap-day recurrence respects century exceptions and count before the queried range", () => {
  const rule: RecurrenceRule = {
    ...daily(),
    frequency: "yearly",
    anchorDate: "1896-02-29",
    end: { type: "count", count: 3 },
  }
  expect(dates(rule, "1896-01-01", "1910-12-31")).toEqual([
    "1896-02-29",
    "1904-02-29",
    "1908-02-29",
  ])
  expect(dates(rule, "1905-01-01", "9999-12-31")).toEqual(["1908-02-29"])
  expect(
    dates({ ...rule, anchorDate: "1996-02-29" }, "1996-01-01", "2010-12-31")
  ).toEqual(["1996-02-29", "2000-02-29", "2004-02-29"])
  expect(
    dates(
      { ...rule, anchorDate: "2000-02-29", interval: 100 },
      "2000-01-01",
      "2500-12-31"
    )
  ).toEqual(["2000-02-29", "2400-02-29"])
})

test("recurrence pages preserve original cadence at supported year bounds and validate query limits", () => {
  const rule = daily({ anchorDate: "0001-01-01" })
  expect(dates(rule, "9999-12-30", "9999-12-31")).toEqual([
    "9999-12-30",
    "9999-12-31",
  ])
  expect(dates(monthly("0001-01-31", 1), "9999-01-01", "9999-12-31")).toEqual(
    []
  )
  expect(
    dates(
      { ...monthly("9999-10-31"), end: { type: "never" } },
      "9999-10-01",
      "9999-12-31"
    )
  ).toEqual(["9999-10-31", "9999-12-31"])
  for (const override of [
    { limit: 0 },
    { limit: 501 },
    { endDate: "0000-01-01" },
    { endDate: "0001-01-01" },
    { afterDate: "2026-10-01" },
  ])
    expect(() =>
      recurrenceDatesPage(rule, {
        ...query("2026-10-07", "2026-10-08"),
        ...override,
      })
    ).toThrow()
})

// Independent day-by-day oracle covers cadences and missing dates over a leap year.
function oracle(rule: RecurrenceRule, last: string): string[] {
  const read = (date: string) => {
    const value = new Date(0)
    const [year, month, day] = date.split("-").map(Number)
    value.setUTCFullYear(year, month - 1, day)
    value.setUTCHours(0, 0, 0, 0)
    return value
  }
  const anchor = read(rule.anchorDate)
  const result: string[] = []
  for (
    const current = read(rule.anchorDate);
    current <= read(last);
    current.setUTCDate(current.getUTCDate() + 1)
  ) {
    const day = current.toISOString().slice(0, 10)
    if (rule.end.type === "until" && day > rule.end.date) break
    const dayDifference = (current.getTime() - anchor.getTime()) / 86400000
    const monthDifference =
      (current.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
      current.getUTCMonth() -
      anchor.getUTCMonth()
    const weekDifference = Math.floor(
      (dayDifference + ((anchor.getUTCDay() + 6) % 7)) / 7
    )
    const matches =
      rule.frequency === "daily"
        ? dayDifference % rule.interval === 0
        : rule.frequency === "weekly"
          ? weekDifference % rule.interval === 0 &&
            rule.weekdays.includes(current.getUTCDay())
          : rule.frequency === "monthly"
            ? monthDifference % rule.interval === 0 &&
              current.getUTCDate() === anchor.getUTCDate()
            : (current.getUTCFullYear() - anchor.getUTCFullYear()) %
                rule.interval ===
                0 &&
              current.getUTCMonth() === anchor.getUTCMonth() &&
              current.getUTCDate() === anchor.getUTCDate()
    if (matches) result.push(day)
    if (rule.end.type === "count" && result.length === rule.end.count) break
  }
  return result
}

test("paged civil recurrence matches an independent oracle for all frequencies and sparse intervals", () => {
  for (const anchorDate of [
    "2023-01-29",
    "2023-01-30",
    "2023-01-31",
    "2024-02-29",
  ])
    for (const frequency of ["daily", "weekly", "monthly", "yearly"] as const)
      for (const interval of [1, 2, 5, 365]) {
        const rule: RecurrenceRule =
          frequency === "weekly"
            ? {
                ...daily({ anchorDate, interval }),
                frequency,
                weekdays: [5, 0, 2],
              }
            : { ...daily({ anchorDate, interval }), frequency }
        for (const end of [
          { type: "never" },
          { type: "count", count: 7 },
          { type: "until", date: "2025-01-31" },
        ] as const) {
          const active = { ...rule, end }
          const expected = oracle(active, "2025-12-31").filter(
            (date) => date >= "2024-01-01"
          )
          const actual: string[] = []
          let afterDate: string | null = null
          do {
            const page = recurrenceDatesPage(active, {
              ...query("2024-01-01", "2025-12-31", 3),
              afterDate,
            })
            actual.push(...page.dates)
            afterDate = page.nextAfter
          } while (afterDate)
          expect(actual).toEqual(expected)
        }
      }
})

test("monthly global counts remain exact after complete Gregorian validity cycles", () => {
  expect(
    dates(monthly("0001-01-31", 2801), "0401-01-01", "0401-12-31")
  ).toEqual(["0401-01-31"])
  expect(
    dates(
      { ...monthly("0001-01-31", 1601), interval: 2 },
      "0401-01-01",
      "0401-12-31"
    )
  ).toEqual(["0401-01-31"])
  expect(
    dates(
      { ...monthly("0004-02-29", 98), interval: 12 },
      "0401-01-01",
      "0408-12-31"
    )
  ).toEqual(["0404-02-29"])
})
