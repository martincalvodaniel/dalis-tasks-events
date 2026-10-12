import { expect, test } from "bun:test"
import { shiftPlanEndDate } from "@/features/plans/plan-form-dates"
import { adjacentFormDate } from "@/lib/calendar/form-date"

test("start changes preserve civil duration across months, years and leap days", () => {
  expect(shiftPlanEndDate("2026-10-10", "2026-10-12", "2026-11-30")).toBe(
    "2026-12-02"
  )
  expect(shiftPlanEndDate("2026-10-10", "2026-10-12", "2024-02-28")).toBe(
    "2024-03-01"
  )
  expect(shiftPlanEndDate("2026-10-10", "2026-10-10", "0001-01-01")).toBe(
    "0001-01-01"
  )
  expect(shiftPlanEndDate("2026-03-28", "2026-03-30", "2026-10-24")).toBe(
    "2026-10-26"
  )
})

test("a manually changed end establishes the next duration, while absent or incomplete dates stay safe", () => {
  expect(shiftPlanEndDate("2026-10-10", "2026-10-15", "2026-10-11")).toBe(
    "2026-10-16"
  )
  expect(shiftPlanEndDate("2026-10-10", "", "2026-10-11")).toBe("")
  expect(shiftPlanEndDate("2026-10-10", "2026-10-12", "")).toBe("2026-10-12")
  expect(shiftPlanEndDate("", "2026-10-12", "2026-10-11")).toBe("2026-10-12")
  expect(shiftPlanEndDate("2026-10-10", "2026-02-30", "2026-10-11")).toBe(
    "2026-02-30"
  )
  expect(shiftPlanEndDate("2026-10-10", "2026-10-09", "2026-10-11")).toBe(
    "2026-10-11"
  )
})

test("end coupling and arrows respect representable schedule boundaries", () => {
  expect(
    shiftPlanEndDate("2026-10-10", "2026-10-12", "9999-12-30", "9999-12-30")
  ).toBe("9999-12-30")
  expect(
    shiftPlanEndDate("2026-10-10", "2026-10-12", "9999-12-31", "9999-12-30")
  ).toBe("2026-10-12")
  expect(adjacentFormDate("0001-01-01", -1)).toBeNull()
  expect(adjacentFormDate("9999-12-31", 1)).toBeNull()
  expect(
    adjacentFormDate("9999-12-30", 1, "0001-01-01", "9999-12-30")
  ).toBeNull()
  expect(adjacentFormDate("2024-02-28", 1)).toBe("2024-02-29")
  expect(adjacentFormDate("2026-03-01", -1)).toBe("2026-02-28")
  expect(adjacentFormDate("", 1)).toBeNull()
  expect(adjacentFormDate("2026-02-30", -1)).toBeNull()
})
