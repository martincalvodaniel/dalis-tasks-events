import { describe, expect, test } from "bun:test"
import {
  adjacentMonth,
  calendarDateFromSearch,
  calendarHref,
  calendarWeeks,
} from "@/features/calendar/month-view"

describe("monthly calendar navigation", () => {
  test("validates URL dates and keeps a selected day when opening the workspace", () => {
    expect(calendarDateFromSearch("?view=calendar&date=2026-10-06")).toBe(
      "2026-10-06"
    )
    for (const value of ["2026-02-30", "0000-01-01", "wrong", ""])
      expect(calendarDateFromSearch(`?date=${value}`)).toBeNull()
    expect(calendarHref("2026-10-06")).toBe(
      "/workspace?view=calendar&date=2026-10-06"
    )
  })
  test("clamps the selected day across leap months and bounds the supported years", () => {
    expect(adjacentMonth("2024-01-31", 1)).toBe("2024-02-29")
    expect(adjacentMonth("2026-03-31", -1)).toBe("2026-02-28")
    expect(adjacentMonth("2026-12-07", 1)).toBe("2027-01-07")
    expect(adjacentMonth("0001-01-01", -1)).toBeNull()
    expect(adjacentMonth("9999-12-31", 1)).toBeNull()
  })
  test("uses complete Monday-first weeks without overflowing extreme dates", () => {
    const weeks = calendarWeeks("2026-10-06")
    expect(weeks).toHaveLength(5)
    expect(weeks[0][0].date).toBe("2026-09-28")
    expect(weeks.at(-1)?.at(-1)?.date).toBe("2026-11-01")
    expect(weeks.flat().filter((cell) => cell.inMonth)).toHaveLength(31)
    expect(
      calendarWeeks("0001-01-01")
        .flat()
        .find((cell) => cell.inMonth)?.date
    ).toBe("0001-01-01")
    const end = calendarWeeks("9999-12-31").flat()
    expect(end.some((cell) => cell.date === null)).toBe(true)
    expect(end.filter((cell) => cell.inMonth)).toHaveLength(31)
    expect(calendarWeeks("2021-02-01")).toHaveLength(4)
  })
})
