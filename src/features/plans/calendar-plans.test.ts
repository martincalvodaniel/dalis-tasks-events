import { expect, test } from "bun:test"
import {
  planCalendarCounts,
  planCalendarSummary,
} from "@/features/plans/calendar-plans"
import { readPlanAppearancePage } from "@/lib/calendar/plan-appearance-page"
import { createPlanOccurrenceIndex } from "@/lib/calendar/plan-occurrence-selection"
import { planSchema } from "@/schemas/plan-item"
import type { Plan, PlanVariant } from "@/types/plan-item"

function parent(variant: PlanVariant, index: number, recurring = false): Plan {
  return planSchema.parse({
    kind: "plan",
    variant,
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    ownerId: "calendar-plan-owner",
    title: "Plan",
    description: "",
    status: "not_started",
    completedAt: null,
    checklist: [],
    schedule: {
      mode: "all_day",
      startDate: "2026-10-10",
      endDateExclusive: "2026-10-12",
    },
    recurrence: recurring
      ? {
          frequency: "daily",
          anchorDate: "2026-10-10",
          interval: 1,
          timeZone: "Europe/Madrid",
          end: { type: "count", count: 2 },
        }
      : null,
    revision: 0,
    createdAt: "2026-10-10T12:00:00.000Z",
    updatedAt: "2026-10-10T12:00:00.000Z",
    deletedAt: null,
  })
}
const variants: PlanVariant[] = ["task", "event", "appointment", "note"]

test("calendar counts four variants together across civil intervals and preserves snapshots", () => {
  const plans = variants.map((variant, index) => parent(variant, index + 1))
  const snapshot = structuredClone(plans)
  const result = planCalendarCounts(plans, [], {
    startDate: "2026-10-09",
    endDate: "2026-10-12",
  })
  expect([...result.values()]).toEqual([0, 4, 4, 0])
  expect(plans).toEqual(snapshot)
})

test("recurring templates do not count as appearances and loaded slots count exactly once", () => {
  const plan = parent("appointment", 1, true)
  const range = { startDate: "2026-10-10", endDate: "2026-10-12" }
  const index = createPlanOccurrenceIndex([plan], [], plan.ownerId)
  const firstPage = index.generatedPage(plan.id, { ...range, limit: 1 })
  expect([...planCalendarCounts([plan], [], range).values()]).toEqual([0, 0, 0])
  expect([
    ...planCalendarCounts([plan], firstPage.views, range).values(),
  ]).toEqual([1, 1, 0])
  const second = index.generatedPage(plan.id, {
    ...range,
    afterDate: firstPage.nextAfter,
  })
  expect([
    ...planCalendarCounts(
      [plan],
      [...firstPage.views, ...second.views],
      range
    ).values(),
  ]).toEqual([1, 2, 1])
  expect(() =>
    planCalendarCounts([plan], [...firstPage.views, ...firstPage.views], range)
  ).toThrow("Duplicate")
})

test("invalid or oversized calendar grids reject instead of silently truncating counts", () => {
  expect(() =>
    planCalendarCounts([], [], {
      startDate: "2026-10-10",
      endDate: "2026-10-09",
    })
  ).toThrow()
  expect(() =>
    planCalendarCounts([], [], {
      startDate: "2026-10-01",
      endDate: "2026-11-12",
    })
  ).toThrow("limit")
  expect(() =>
    planCalendarCounts([], [], { startDate: "invalid", endDate: "2026-10-09" })
  ).toThrow()
})

test("calendar pending indicator follows status for every variant without changing totals", () => {
  const range = { startDate: "2026-10-09", endDate: "2026-10-12" }
  for (const variant of variants) {
    for (const status of ["not_started", "in_progress", "completed"] as const) {
      const plan = planSchema.parse({
        ...parent(variant, 1),
        status,
        completedAt: status === "completed" ? "2026-10-10T12:00:00.000Z" : null,
      })
      const result = planCalendarSummary([plan], [], range)
      expect([...result.counts.values()]).toEqual([0, 1, 1, 0])
      expect([...result.incompleteDates]).toEqual(
        status === "completed" ? [] : ["2026-10-10", "2026-10-11"]
      )
    }
  }
})

test("pending indicators use each occurrence's progress and ignore deleted or cancelled content", () => {
  const series = parent("task", 1, true)
  const range = { startDate: "2026-10-10", endDate: "2026-10-12" }
  const initial = readPlanAppearancePage([series], [], series.ownerId, range)
  const completed = {
    ...initial.views[0].occurrence,
    status: "completed" as const,
    completedAt: "2026-10-10T12:00:00.000Z",
  }
  const deleted = {
    ...parent("task", 2),
    deletedAt: "2026-10-10T12:00:00.000Z",
  }
  const views = readPlanAppearancePage(
    [series],
    [completed],
    series.ownerId,
    range
  ).views
  const result = planCalendarSummary([series, deleted], views, range)
  expect([...result.counts.values()]).toEqual([1, 2, 1])
  expect([...result.incompleteDates]).toEqual(["2026-10-11", "2026-10-12"])
  const cancelled = { ...initial.views[1].occurrence, cancelled: true }
  const after = planCalendarSummary(
    [series, deleted],
    readPlanAppearancePage(
      [series],
      [completed, cancelled],
      series.ownerId,
      range
    ).views,
    range
  )
  expect([...after.counts.values()]).toEqual([1, 1, 0])
  expect([...after.incompleteDates]).toEqual([])
})
