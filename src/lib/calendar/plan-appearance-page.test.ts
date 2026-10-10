import { describe, expect, test } from "bun:test"
import { readPlanAppearancePage } from "@/lib/calendar/plan-appearance-page"
import { planOccurrencesPage } from "@/lib/calendar/plan-occurrences"
import {
  type PlanAppearanceCursor,
  planAppearanceCursorSchema,
} from "@/schemas/plan-appearance-query"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import type { Plan, PlanVariant } from "@/types/plan-item"

const owner = "appearance-owner"
const now = "2026-10-10T14:00:00.000Z"
function uuid(value: number) {
  return `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`
}
function parent(
  value = 1,
  variant: PlanVariant = "task",
  schedule: Plan["schedule"] = {
    mode: "all_day",
    startDate: "2026-10-10",
    endDateExclusive: "2026-10-13",
  }
): Plan {
  const startDate =
    schedule.mode === "all_day"
      ? schedule.startDate
      : schedule.localStart.slice(0, 10)
  return planSchema.parse({
    kind: "plan",
    variant,
    id: uuid(value),
    ownerId: owner,
    title: "Recurring appearance",
    description: "Details",
    status: "not_started",
    completedAt: null,
    checklist: [{ id: uuid(99), text: "Step", completed: false }],
    schedule,
    recurrence: {
      frequency: "daily",
      anchorDate: startDate,
      interval: 1,
      timeZone: schedule.mode === "timed" ? schedule.timeZone : "Europe/Madrid",
      end: { type: "never" },
    },
    revision: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
}
function occurrence(series: Plan, date = "2026-10-10") {
  return planOccurrencesPage(series, { startDate: date, endDate: date })
    .occurrences[0]
}
const query = { startDate: "2026-10-11", endDate: "2026-10-11" }

describe("bounded common plan appearance pages", () => {
  test("all-day lookback includes carryover and respects exclusive ends", () => {
    const series = parent()
    const page = readPlanAppearancePage([series], [], owner, query)
    expect(page.views.map((view) => view.occurrence.slotKey)).toEqual([
      "2026-10-10",
      "2026-10-11",
    ])
    expect(page.nextCursor).toBeNull()
    if (!series.recurrence) throw new Error("Expected a recurring fixture plan")
    const single = {
      ...series,
      recurrence: {
        ...series.recurrence,
        end: { type: "count" as const, count: 1 },
      },
    }
    expect(
      readPlanAppearancePage([single], [], owner, {
        startDate: "2026-10-12",
        endDate: "2026-10-12",
      }).views
    ).toHaveLength(1)
    expect(
      readPlanAppearancePage([single], [], owner, {
        startDate: "2026-10-13",
        endDate: "2026-10-13",
      }).views
    ).toEqual([])
  })
  test("timed civil duration carries across days and the minimum civil date is bounded", () => {
    const timed = parent(1, "event", {
      mode: "timed",
      localStart: "2026-10-10T23:00",
      localEnd: "2026-10-12T01:00",
      timeZone: "Europe/Madrid",
    })
    expect(
      readPlanAppearancePage([timed], [], owner, query).views.map(
        (view) => view.occurrence.slotKey
      )
    ).toEqual(["2026-10-10T23:00", "2026-10-11T23:00"])
    const minimum = parent(2, "note", {
      mode: "all_day",
      startDate: "0001-01-01",
      endDateExclusive: "0001-01-05",
    })
    expect(
      readPlanAppearancePage([minimum], [], owner, {
        startDate: "0001-01-02",
        endDate: "0001-01-02",
      }).views.map((view) => view.occurrence.slotKey)
    ).toEqual(["0001-01-01", "0001-01-02"])
  })
  test("exceptions come first and moved, cancelled and deleted original slots never return", () => {
    const series = parent()
    const moved = planOccurrenceSchema.parse({
      ...occurrence(series),
      schedule: {
        mode: "all_day",
        startDate: "2026-11-01",
        endDateExclusive: "2026-11-03",
      },
    })
    const cancelled = { ...occurrence(series, "2026-10-11"), cancelled: true }
    const deleted = { ...occurrence(series, "2026-10-12"), deletedAt: now }
    const original = readPlanAppearancePage(
      [series],
      [moved, cancelled, deleted],
      owner,
      { startDate: "2026-10-10", endDate: "2026-10-12" }
    )
    expect(original.views).toEqual([])
    const current = readPlanAppearancePage([series], [moved], owner, {
      startDate: "2026-11-02",
      endDate: "2026-11-02",
      limit: 1,
    })
    expect(current.views[0].occurrence.id).toBe(moved.id)
    expect(current.nextCursor).toEqual({
      phase: "generated",
      seriesId: series.id,
      afterDate: null,
    })
    const tail = readPlanAppearancePage(
      [series],
      [moved],
      owner,
      { startDate: "2026-11-02", endDate: "2026-11-02", limit: 1 },
      current.nextCursor
    )
    expect(tail.views.map((view) => view.occurrence.slotKey)).toEqual([
      "2026-10-31",
    ])
  })
  test("exception pagination keeps its explicit cursor before generation", () => {
    const first = parent(1)
    const second = parent(2)
    const exceptions = [occurrence(first), occurrence(second)]
    const page = readPlanAppearancePage(
      [second, first],
      exceptions,
      owner,
      query,
      { phase: "exceptions", after: null }
    )
    expect(page.views.slice(0, 2).map((view) => view.seriesId)).toEqual([
      first.id,
      second.id,
    ])
    const bounded = readPlanAppearancePage([second, first], exceptions, owner, {
      ...query,
      limit: 1,
    })
    expect(bounded.nextCursor).toEqual({
      phase: "exceptions",
      after: { start: "2026-10-10", id: exceptions[0].id },
    })
    const next = readPlanAppearancePage(
      [second, first],
      exceptions,
      owner,
      { ...query, limit: 1 },
      bounded.nextCursor
    )
    expect(next.views[0].seriesId).toBe(second.id)
    expect(next.nextCursor).toEqual({
      phase: "generated",
      seriesId: first.id,
      afterDate: null,
    })
  })
  test("empty filtered generation advances dates and exactly one series per call", () => {
    const first = parent(1, "task", {
      mode: "all_day",
      startDate: "2026-10-10",
      endDateExclusive: "2026-10-11",
    })
    const second = parent(2, "note", first.schedule)
    const exceptions = ["2026-10-10", "2026-10-11", "2026-10-12"].map(
      (date) => ({ ...occurrence(first, date), cancelled: true })
    )
    const span = { startDate: "2026-10-10", endDate: "2026-10-12", limit: 1 }
    let cursor: PlanAppearanceCursor | null = null
    for (const date of ["2026-10-10", "2026-10-11"]) {
      const page = readPlanAppearancePage(
        [second, first],
        exceptions,
        owner,
        span,
        cursor
      )
      expect(page.views).toEqual([])
      expect(page.nextCursor).toEqual({
        phase: "generated",
        seriesId: first.id,
        afterDate: date,
      })
      cursor = page.nextCursor
    }
    const last = readPlanAppearancePage(
      [second, first],
      exceptions,
      owner,
      span,
      cursor
    )
    expect(last.views).toEqual([])
    expect(last.nextCursor).toEqual({
      phase: "generated",
      seriesId: second.id,
      afterDate: null,
    })
    const nextSeries = readPlanAppearancePage(
      [second, first],
      exceptions,
      owner,
      span,
      last.nextCursor
    )
    expect(nextSeries.views).toHaveLength(1)
    expect(nextSeries.views[0].variant).toBe("note")
  })
  test("four variants and future anchors advance through stable series identities", () => {
    const variants = ["task", "event", "appointment", "note"] as const
    const parents = variants.map((variant, index) =>
      parent(index + 1, variant, {
        mode: "all_day",
        startDate: "2026-11-01",
        endDateExclusive: "2026-11-02",
      })
    )
    let cursor: PlanAppearanceCursor | null = null
    for (let index = 0; index < parents.length; index++) {
      const page = readPlanAppearancePage(
        parents.toReversed(),
        [],
        owner,
        query,
        cursor
      )
      expect(page.views).toEqual([])
      expect(page.nextCursor).toEqual(
        index === parents.length - 1
          ? null
          : {
              phase: "generated",
              seriesId: parents[index + 1].id,
              afterDate: null,
            }
      )
      cursor = page.nextCursor
    }
    for (const series of parents)
      expect(
        readPlanAppearancePage([series], [], owner, {
          startDate: "2026-11-01",
          endDate: "2026-11-01",
        }).views[0].variant
      ).toBe(series.variant)
  })
  test("invalid DST slots remain issues and advance the original generation date", () => {
    const series = parent(1, "appointment", {
      mode: "timed",
      localStart: "2026-03-28T02:30",
      localEnd: null,
      timeZone: "Europe/Madrid",
    })
    const span = { startDate: "2026-03-29", endDate: "2026-03-30", limit: 1 }
    const page = readPlanAppearancePage([series], [], owner, span)
    expect(page.views).toEqual([])
    expect(page.issues).toMatchObject([
      { id: `${series.id}:2026-03-29T02:30`, reason: "nonexistent" },
    ])
    expect(page.nextCursor).toEqual({
      phase: "generated",
      seriesId: series.id,
      afterDate: "2026-03-29",
    })
    const next = readPlanAppearancePage(
      [series],
      [],
      owner,
      span,
      page.nextCursor
    )
    expect(next.views).toHaveLength(1)
    expect(next.issues).toEqual([])
    expect(next.nextCursor).toBeNull()
  })
  test("strict owner, catalogs, ranges and derived lookback cursor bounds are enforced", () => {
    const series = parent()
    expect(() =>
      planAppearanceCursorSchema.parse({
        phase: "generated",
        seriesId: series.id,
        afterDate: null,
        index: 0,
      })
    ).toThrow()
    expect(() =>
      planAppearanceCursorSchema.parse({
        phase: "exceptions",
        after: { start: "invalid", id: `${series.id}:2026-10-10` },
      })
    ).toThrow()
    expect(
      readPlanAppearancePage([series], [], "another-account", query)
    ).toEqual({ views: [], issues: [], nextCursor: null })
    expect(() =>
      readPlanAppearancePage([series], [], owner, { ...query, limit: 501 })
    ).toThrow()
    expect(() =>
      readPlanAppearancePage([series], [], owner, {
        startDate: "2026-10-12",
        endDate: "2026-10-11",
      })
    ).toThrow()
    expect(() =>
      readPlanAppearancePage(Array(10001).fill(series), [], owner, query)
    ).toThrow()
    expect(() =>
      readPlanAppearancePage(
        [series],
        Array(10001).fill(occurrence(series)),
        owner,
        query
      )
    ).toThrow()
    expect(() =>
      readPlanAppearancePage([series], [], owner, query, {
        phase: "generated",
        seriesId: uuid(2),
        afterDate: null,
      })
    ).toThrow("unavailable series")
    for (const afterDate of ["2026-10-08", "2026-10-12"])
      expect(() =>
        readPlanAppearancePage([series], [], owner, query, {
          phase: "generated",
          seriesId: series.id,
          afterDate,
        })
      ).toThrow()
    expect(
      readPlanAppearancePage([series], [], owner, query, {
        phase: "generated",
        seriesId: series.id,
        afterDate: "2026-10-09",
      }).views
    ).toHaveLength(2)
  })
  test("completed exception filtering and returned snapshots never alter inputs", () => {
    const series = parent()
    const completed = {
      ...occurrence(series),
      status: "completed" as const,
      completedAt: now,
    }
    const originals = structuredClone({ series, completed })
    const page = readPlanAppearancePage([series], [completed], owner, {
      ...query,
      includeCompleted: false,
    })
    expect(page.views.map((view) => view.occurrence.slotKey)).toEqual([
      "2026-10-11",
    ])
    page.views[0].occurrence.checklist[0].text = "Output edit"
    page.views[0].occurrence.schedule = {
      mode: "all_day",
      startDate: "2027-01-01",
      endDateExclusive: "2027-01-02",
    }
    expect({ series, completed }).toEqual(originals)
    expect(
      readPlanAppearancePage([series], [completed], owner, {
        ...query,
        includeCompleted: false,
      }).views[0].occurrence.checklist[0].text
    ).toBe("Step")
  })
})
