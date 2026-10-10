import { describe, expect, test } from "bun:test"
import { createPlanOccurrenceIndex } from "@/lib/calendar/plan-occurrence-selection"
import { planOccurrencesPage } from "@/lib/calendar/plan-occurrences"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import type { Plan, PlanVariant } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"

const now = "2026-10-10T14:00:00.000Z"
const owner = "plan-selection-owner"
const stepId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
function uuid(value: number) {
  return `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`
}
function parent(variant: PlanVariant = "task", value = 1): Plan {
  return planSchema.parse({
    kind: "plan",
    variant,
    id: uuid(value),
    ownerId: owner,
    title: "Parent title",
    description: "Parent description",
    status: "not_started",
    completedAt: null,
    checklist: [{ id: stepId, text: "Independent step", completed: false }],
    schedule: {
      mode: "all_day",
      startDate: "2026-10-10",
      endDateExclusive: "2026-10-11",
    },
    recurrence: {
      frequency: "daily",
      anchorDate: "2026-10-10",
      timeZone: "Europe/Madrid",
      interval: 1,
      end: { type: "never" },
    },
    revision: 2,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
}
function occurrence(series: Plan, date = "2026-10-10"): PlanOccurrence {
  return planOccurrencesPage(series, { startDate: date, endDate: date })
    .occurrences[0]
}
const range = { startDate: "2026-10-10", endDate: "2026-10-12" }

describe("common plan occurrence index", () => {
  test("four parent variants provide visual type, ownership and exception content", () => {
    for (const variant of ["task", "event", "appointment", "note"] as const) {
      const series = parent(variant)
      const exception = planOccurrenceSchema.parse({
        ...occurrence(series),
        content: { title: "Exception title", description: "Exception details" },
      })
      const index = createPlanOccurrenceIndex([series], [exception], owner)
      expect(
        index
          .generatedPage(series.id, range)
          .views.map((view) => view.occurrence.slotKey)
      ).toEqual(["2026-10-11", "2026-10-12"])
      expect(index.exceptionsPage(range).views[0]).toMatchObject({
        seriesId: series.id,
        variant,
        title: "Exception title",
        description: "Exception details",
      })
      expect(index.generatedPage(series.id, range).views[0]).toMatchObject({
        variant,
        title: series.title,
        description: series.description,
      })
      expect(
        createPlanOccurrenceIndex([series], [exception], "another-account")
          .seriesIds
      ).toEqual([])
    }
  })
  test("moved, cancelled and deleted exceptions suppress every original slot", () => {
    const series = parent()
    const moved = planOccurrenceSchema.parse({
      ...occurrence(series),
      schedule: {
        mode: "all_day",
        startDate: "2026-10-20",
        endDateExclusive: "2026-10-21",
      },
    })
    const cancelled = { ...occurrence(series, "2026-10-11"), cancelled: true }
    const deleted = { ...occurrence(series, "2026-10-12"), deletedAt: now }
    const index = createPlanOccurrenceIndex(
      [series],
      [moved, cancelled, deleted],
      owner
    )
    expect(index.generatedPage(series.id, range).views).toEqual([])
    expect(index.exceptionsPage(range).views).toEqual([])
    expect(
      index
        .exceptionsPage({ startDate: "2026-10-20", endDate: "2026-10-20" })
        .views.map((view) => view.occurrence.id)
    ).toEqual([moved.id])
    const first = index.generatedPage(series.id, { ...range, limit: 1 })
    expect(first.views).toEqual([])
    expect(first.nextAfter).toBe("2026-10-10")
    const second = index.generatedPage(series.id, {
      ...range,
      afterDate: first.nextAfter,
      limit: 1,
    })
    expect(second.views).toEqual([])
    expect(second.nextAfter).toBe("2026-10-11")
    const last = index.generatedPage(series.id, {
      ...range,
      afterDate: second.nextAfter,
      limit: 1,
    })
    expect(last.views).toEqual([])
    expect(last.nextAfter).toBeNull()
  })
  test("carryover intervals page from their actual start before the query", () => {
    const first = parent("appointment", 1)
    const second = parent("note", 2)
    const carryover = planOccurrenceSchema.parse({
      ...occurrence(first),
      schedule: {
        mode: "all_day",
        startDate: "2026-09-30",
        endDateExclusive: "2026-10-11",
      },
    })
    const later = occurrence(second)
    const index = createPlanOccurrenceIndex(
      [second, first],
      [later, carryover],
      owner
    )
    const page = index.exceptionsPage({
      startDate: "2026-10-10",
      endDate: "2026-10-10",
      limit: 1,
    })
    expect(page.views.map((view) => view.occurrence.id)).toEqual([carryover.id])
    expect(page.nextCursor).toEqual({ start: "2026-09-30", id: carryover.id })
    const next = index.exceptionsPage({
      startDate: "2026-10-10",
      endDate: "2026-10-10",
      limit: 1,
      after: page.nextCursor,
    })
    expect(next.views.map((view) => view.occurrence.id)).toEqual([later.id])
    expect(next.nextCursor).toBeNull()
    expect(
      index.exceptionsPage({ startDate: "2026-10-11", endDate: "2026-10-11" })
        .views
    ).toEqual([])
  })
  test("timed current starts precede identity tie-breaks and carry across dates", () => {
    const parents = [parent("note", 3), parent("event", 2), parent("task", 1)]
    const exceptions = parents.map((series, position) =>
      planOccurrenceSchema.parse({
        ...occurrence(series),
        schedule: {
          mode: "timed",
          localStart: position === 0 ? "2026-10-09T23:00" : "2026-10-10T09:00",
          localEnd: "2026-10-10T10:00",
          timeZone: "Europe/Madrid",
        },
      })
    )
    const index = createPlanOccurrenceIndex(parents, exceptions, owner)
    const first = index.exceptionsPage({ ...range, limit: 2 })
    expect(first.views.map((view) => view.seriesId)).toEqual([uuid(3), uuid(1)])
    expect(first.nextCursor).toEqual({
      start: "2026-10-10T09:00",
      id: exceptions[2].id,
    })
    const next = index.exceptionsPage({
      ...range,
      limit: 2,
      after: first.nextCursor,
    })
    expect(next.views.map((view) => view.seriesId)).toEqual([uuid(2)])
    expect(next.nextCursor).toBeNull()
  })
  test("completed exceptions are optional and never resurrect their generated slot", () => {
    const series = parent()
    const completed = {
      ...occurrence(series),
      status: "completed" as const,
      completedAt: now,
    }
    const index = createPlanOccurrenceIndex([series], [completed], owner)
    expect(index.exceptionsPage(range).views).toHaveLength(1)
    expect(
      index.exceptionsPage({ ...range, includeCompleted: false }).views
    ).toEqual([])
    expect(
      index.generatedPage(series.id, { ...range, includeCompleted: false })
        .views
    ).toHaveLength(2)
  })
  test("rejects duplicate own identities, oversized catalogs and invalid cursors", () => {
    const series = parent()
    const exception = occurrence(series)
    expect(() =>
      createPlanOccurrenceIndex([series, series], [], owner)
    ).toThrow("Duplicate plan series identity")
    expect(() =>
      createPlanOccurrenceIndex([series], [exception, exception], owner)
    ).toThrow("Duplicate plan occurrence identity")
    expect(() =>
      createPlanOccurrenceIndex(Array(10001).fill(series), [], owner)
    ).toThrow()
    expect(() =>
      createPlanOccurrenceIndex([], Array(10001).fill(exception), owner)
    ).toThrow()
    const index = createPlanOccurrenceIndex([series], [exception], owner)
    for (const query of [
      { ...range, limit: 501 },
      { ...range, startDate: "2026-10-13" },
      { ...range, after: { start: "2026-10-13T10:00", id: exception.id } },
      { ...range, after: { start: "invalid", id: exception.id } },
      { ...range, extra: true },
    ])
      expect(() => index.exceptionsPage(query)).toThrow()
    expect(() =>
      index.generatedPage(series.id, { ...range, afterDate: "2026-10-09" })
    ).toThrow()
  })
  test("ignores inactive, simple and foreign parents without leaking exceptions", () => {
    const series = parent()
    const inactive = { ...parent("note", 2), deletedAt: now }
    const foreign = { ...parent("event", 3), ownerId: "another-account" }
    const simple = { ...parent("appointment", 4), recurrence: null }
    const index = createPlanOccurrenceIndex(
      [series, inactive, foreign, simple],
      [
        occurrence(series),
        { ...occurrence(parent("note", 2)), deletedAt: now },
        occurrence(foreign),
        occurrence(parent("appointment", 4)),
      ],
      owner
    )
    expect(index.seriesIds).toEqual([series.id])
    expect(
      index.exceptionsPage(range).views.map((view) => view.seriesId)
    ).toEqual([series.id])
    expect(index.generatedPage(foreign.id, range)).toEqual({
      views: [],
      issues: [],
      nextAfter: null,
    })
  })
  test("source and returned snapshots cannot mutate later pages", () => {
    const series = parent()
    const exception = occurrence(series)
    const index = createPlanOccurrenceIndex([series], [exception], owner)
    const before = index.exceptionsPage(range)
    series.variant = "note"
    series.title = "External edit"
    exception.checklist[0].completed = true
    exception.schedule = {
      mode: "all_day",
      startDate: "2026-11-10",
      endDateExclusive: "2026-11-11",
    }
    expect(index.exceptionsPage(range)).toEqual(before)
    before.views[0].occurrence.checklist[0].text = "Returned edit"
    before.views[0].variant = "event"
    expect(index.exceptionsPage(range).views[0]).toMatchObject({
      variant: "task",
      title: "Parent title",
      occurrence: {
        checklist: [{ text: "Independent step", completed: false }],
      },
    })
    const generated = index.generatedPage(series.id, range)
    generated.views[0].occurrence.checklist[0].completed = true
    expect(
      index.generatedPage(series.id, range).views[0].occurrence.checklist[0]
        .completed
    ).toBe(false)
    expect(() => (index.seriesIds as string[]).push(uuid(2))).toThrow()
  })
})
