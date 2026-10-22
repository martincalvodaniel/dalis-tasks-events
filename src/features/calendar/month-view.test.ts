import { describe, expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MonthGrid } from "@/features/calendar/components/month-grid"
import {
  adjacentMonth,
  calendarDateFromSearch,
  calendarHref,
  calendarWeeks,
  monthSwipeOffset,
} from "@/features/calendar/month-view"

describe("monthly calendar navigation", () => {
  test("changes only for deliberate horizontal movement in either direction", () => {
    expect(monthSwipeOffset(-64, 0)).toBe(1)
    expect(monthSwipeOffset(80, 20)).toBe(-1)
    for (const [dx, dy] of [
      [0, 0],
      [63, 0],
      [-40, 1],
      [70, 60],
      [60, 90],
      [90, 60],
      [NaN, 0],
      [100, Infinity],
    ])
      expect(monthSwipeOffset(dx, dy)).toBeNull()
  })
  test("keeps today and the month in one header without arrow controls", () => {
    const markup = renderToStaticMarkup(
      createElement(MonthGrid, {
        selectedDate: "2026-10-11",
        today: "2026-10-11",
        counts: new Map(),
      })
    )
    expect(markup).toContain("octubre de 2026")
    expect(markup).toContain("data-calendar-control")
    expect(markup).toContain(">Hoy</span>")
    expect(markup).toContain("Re Pág y Av Pág")
    expect(markup).not.toContain(">Anterior<")
    expect(markup).not.toContain(">Siguiente<")
    expect(markup).toContain("touch-pan-y touch-pinch-zoom")
    expect(markup).not.toContain("overflow-x-auto")
    expect(markup).not.toContain("min-w-[15rem]")
    expect(markup).toContain('draggable="false"')
  })
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

test("pending day colors only its dot and exposes completion state accessibly", () => {
  const markup = renderToStaticMarkup(
    createElement(MonthGrid, {
      selectedDate: "2026-10-11",
      today: "2026-10-11",
      counts: new Map([
        ["2026-10-11", 2],
        ["2026-10-12", 1],
      ]),
      incompleteDates: new Set(["2026-10-11"]),
    })
  )
  expect(markup).toContain("2 elementos, planes sin completar")
  expect(markup).toContain('lunes, 12 de octubre de 2026, 1 elemento"')
  expect(markup.match(/class="text-red-500 dark:text-red-400"/g)).toHaveLength(
    1
  )
  expect(markup).toContain(
    '2 <span class="text-red-500 dark:text-red-400">·</span>'
  )
})
