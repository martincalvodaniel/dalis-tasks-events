import { describe, expect, test } from "bun:test"
import {
  addCivilDays,
  civilDateInTimeZone,
  todayInTimeZone,
} from "@/lib/calendar/civil-date"
import {
  datesInRange,
  monthGridRange,
  monthRange,
} from "@/lib/calendar/date-range"
import { isTaskOverdue, selectOverdueTasks } from "@/lib/calendar/overdue"
import { calendarItemSchema, taskSchema } from "@/schemas/calendar-item"
import { itemOccurrenceSchema } from "@/schemas/occurrence"

const id = "6b7b5260-2156-462c-b0d0-3bca4b245917"
const metadata = {
  revision: 0,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  deletedAt: null,
}
const task = taskSchema.parse({
  ...metadata,
  id,
  ownerId: "test-owner",
  kind: "task",
  title: "Test task",
  description: "",
  scheduledDate: "2026-10-06",
  status: "in_progress",
  checklist: [],
  recurrence: null,
  completedAt: null,
})

describe("civil calendar", () => {
  test("uses the account's day at midnight rather than the UTC day", () => {
    const instant = new Date("2026-10-06T22:30:00.000Z")
    expect(civilDateInTimeZone(instant, "Europe/Madrid")).toBe("2026-10-07")
    expect(civilDateInTimeZone(instant, "America/Los_Angeles")).toBe(
      "2026-10-06"
    )
    expect(todayInTimeZone("Europe/Madrid", () => instant)).toBe("2026-10-07")
    expect(
      civilDateInTimeZone(
        new Date("2026-01-01T00:01:00.000Z"),
        "Pacific/Honolulu"
      )
    ).toBe("2025-12-31")
  })

  test("civil day arithmetic survives leap years, DST and low years", () => {
    expect(addCivilDays("2024-02-28", 1)).toBe("2024-02-29")
    expect(addCivilDays("2025-02-28", 1)).toBe("2025-03-01")
    expect(addCivilDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(addCivilDays("2026-03-29", 1)).toBe("2026-03-30")
    expect(addCivilDays("0099-12-31", 1)).toBe("0100-01-01")
    expect(addCivilDays("0100-01-01", -1)).toBe("0099-12-31")
    expect(
      civilDateInTimeZone(new Date("2026-03-29T01:30:00.000Z"), "Europe/Madrid")
    ).toBe("2026-03-29")
    expect(
      civilDateInTimeZone(new Date("2026-10-25T01:30:00.000Z"), "Europe/Madrid")
    ).toBe("2026-10-25")
  })

  test("rejects invalid dates, clocks, zones and unsupported overflow", () => {
    expect(() => addCivilDays("2025-02-29", 1)).toThrow()
    expect(() => addCivilDays("0000-01-01", 1)).toThrow()
    expect(() => addCivilDays("0001-01-01", -1)).toThrow()
    expect(() => addCivilDays("9999-12-31", 1)).toThrow()
    expect(() => addCivilDays("2026-10-06", 0.5)).toThrow()
    expect(() => civilDateInTimeZone(new Date("invalid"), "UTC")).toThrow()
    expect(() => civilDateInTimeZone(new Date(), "Invalid/Zone")).toThrow()
  })

  test("month grid covers complete Monday-first weeks and is bounded", () => {
    expect(monthRange("2024-02-29")).toEqual({
      start: "2024-02-01",
      endExclusive: "2024-03-01",
    })
    expect(monthGridRange("2026-02-14")).toEqual({
      start: "2026-01-26",
      endExclusive: "2026-03-02",
    })
    expect(datesInRange(monthGridRange("2026-02-14"))).toHaveLength(35)
    expect(datesInRange(monthGridRange("2021-02-14"))).toHaveLength(28)
    expect(datesInRange(monthGridRange("2026-08-14"))).toHaveLength(42)
    expect(
      datesInRange({ start: "2026-01-01", endExclusive: "2026-01-01" })
    ).toEqual([])
    expect(() => datesInRange(monthRange("2024-02-29"), 28)).toThrow()
    expect(() =>
      datesInRange({ start: "2026-01-02", endExclusive: "2026-01-01" })
    ).toThrow()
  })

  test("overdue changes at the local day boundary and preserves data", () => {
    const items = [task]
    expect(
      selectOverdueTasks(
        items,
        "Europe/Madrid",
        () => new Date("2026-10-06T21:59:59.000Z")
      )
    ).toEqual([])
    const overdue = selectOverdueTasks(
      items,
      "Europe/Madrid",
      () => new Date("2026-10-06T22:00:00.000Z")
    )
    expect(overdue).toEqual([task])
    expect(overdue[0]).toBe(task)
    expect(task.status).toBe("in_progress")
    expect(task.scheduledDate).toBe("2026-10-06")
    expect(items).toEqual([task])
    expect(
      isTaskOverdue({ ...task, status: "not_started" }, "2026-10-07")
    ).toBe(true)
    expect(
      isTaskOverdue({ ...task, scheduledDate: "2026-12-31" }, "2027-01-01")
    ).toBe(true)
  })

  test("excludes completed, deleted, future and non-task records", () => {
    const birthday = calendarItemSchema.parse({
      ...metadata,
      id,
      ownerId: "test-owner",
      kind: "birthday",
      title: "Test birthday",
      description: "",
      month: 10,
      day: 6,
      birthYear: null,
      timeZone: "Europe/Madrid",
    })
    const event = calendarItemSchema.parse({
      ...metadata,
      id,
      ownerId: "test-owner",
      kind: "event",
      title: "Test event",
      description: "",
      schedule: {
        mode: "all_day",
        startDate: "2026-10-06",
        endDateExclusive: "2026-10-07",
      },
      recurrence: null,
    })
    for (const item of [
      birthday,
      event,
      { ...task, status: "completed" as const },
      { ...task, deletedAt: metadata.updatedAt },
      { ...task, scheduledDate: "2026-10-08" },
    ]) {
      expect(isTaskOverdue(item, "2026-10-07")).toBe(false)
    }
  })

  test("recurring parents do not duplicate occurrences; cancellation is respected", () => {
    const series = taskSchema.parse({
      ...task,
      recurrence: {
        frequency: "daily",
        interval: 1,
        anchorDate: task.scheduledDate,
        timeZone: "Europe/Madrid",
        end: { type: "never" },
      },
    })
    const occurrence = itemOccurrenceSchema.parse({
      ...metadata,
      id: `${id}:2026-10-06`,
      seriesId: id,
      slotKey: "2026-10-06",
      cancelled: false,
      kind: "task",
      scheduledDate: "2026-10-05",
      status: "in_progress",
      checklist: [],
      completedAt: null,
    })
    expect(isTaskOverdue(series, "2026-10-07")).toBe(false)
    expect(isTaskOverdue(occurrence, "2026-10-07")).toBe(true)
    expect(
      isTaskOverdue({ ...occurrence, cancelled: true }, "2026-10-07")
    ).toBe(false)
  })
})
