import { expect, test } from "bun:test"
import { createPlanAgendaRows } from "@/features/plans/plan-agenda-rows"
import { readPlanAppearanceSelection } from "@/lib/calendar/plan-appearance-selection"
import { planOccurrencesPage } from "@/lib/calendar/plan-occurrences"
import { planSchema } from "@/schemas/plan-item"

const userId = "complete-day-owner"
const date = "2026-10-19"
function series(index: number) {
  return planSchema.parse({
    kind: "plan",
    variant: "task",
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    ownerId: userId,
    title: `Series ${index}`,
    description: "",
    status: "not_started",
    checklist: [],
    completedAt: null,
    schedule: {
      mode: "all_day",
      startDate: date,
      endDateExclusive: "2026-10-20",
    },
    recurrence: {
      frequency: "daily",
      anchorDate: date,
      interval: 1,
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
    revision: 0,
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
    deletedAt: null,
  })
}
test("a day drains more than fifty series with no cursor or duplicated appearance", () => {
  const plans = Array.from({ length: 61 }, (_, index) => series(index + 1))
  const before = structuredClone(plans)
  const result = readPlanAppearanceSelection(
    plans,
    [],
    userId,
    { startDate: date, endDate: date },
    1
  )
  expect(result.nextCursor).toBeNull()
  expect(result.views).toHaveLength(61)
  expect(new Set(result.views.map((view) => view.occurrence.id)).size).toBe(61)
  expect(
    createPlanAgendaRows(plans, result.views, { kind: "day", date })
  ).toHaveLength(61)
  expect(plans).toEqual(before)
})
test("a complete day includes exceptions and carryovers while excluding cancelled and moved-away slots", () => {
  const parent = series(1)
  parent.schedule = {
    mode: "all_day",
    startDate: "2026-10-18",
    endDateExclusive: "2026-10-20",
  }
  if (!parent.recurrence) throw new Error("Expected recurring fixture")
  parent.recurrence.anchorDate = "2026-10-18"
  const originals = planOccurrencesPage(parent, {
    startDate: "2026-10-18",
    endDate: date,
  }).occurrences
  const cancelled = { ...originals[0], cancelled: true }
  const changed = { ...originals[1], status: "in_progress" as const }
  const input = [cancelled, changed]
  const before = structuredClone(input)
  const result = readPlanAppearanceSelection(
    [parent],
    input,
    userId,
    { startDate: date, endDate: date, limit: 1 },
    1
  )
  expect(result.nextCursor).toBeNull()
  expect(result.views.map((view) => view.occurrence)).toEqual([changed])
  expect(input).toEqual(before)
  const moved = {
    ...changed,
    schedule: {
      mode: "all_day" as const,
      startDate: "2026-10-21",
      endDateExclusive: "2026-10-23",
    },
  }
  expect(
    readPlanAppearanceSelection(
      [parent],
      [cancelled, moved],
      userId,
      { startDate: date, endDate: date },
      1
    ).views
  ).toEqual([])
})
test("intervals retain explicit paging while a single-day empty range completes", () => {
  const plans = [series(1), series(2)]
  const range = { startDate: date, endDate: "2026-10-20" }
  const first = readPlanAppearanceSelection(plans, [], userId, range, 1)
  expect(first.views).toHaveLength(2)
  expect(first.nextCursor).not.toBeNull()
  const complete = readPlanAppearanceSelection(plans, [], userId, range, 2)
  expect(complete.views).toHaveLength(4)
  expect(complete.nextCursor).toBeNull()
  expect(
    readPlanAppearanceSelection(
      [],
      [],
      userId,
      { startDate: date, endDate: date },
      1
    )
  ).toEqual({ views: [], issues: [], nextCursor: null })
})

test("all interval pages drain more than fifty series without losing rows or changing numeric paging", () => {
  const plans = Array.from({ length: 61 }, (_, index) => series(index + 1))
  const query = { startDate: date, endDate: "2026-10-20" }
  const before = structuredClone(plans)
  const partial = readPlanAppearanceSelection(plans, [], userId, query, 1)
  expect(partial.nextCursor).not.toBeNull()
  const complete = readPlanAppearanceSelection(plans, [], userId, query, "all")
  expect(complete.nextCursor).toBeNull()
  expect(complete.views).toHaveLength(122)
  expect(new Set(complete.views.map((view) => view.occurrence.id)).size).toBe(
    122
  )
  expect(complete.issues).toEqual([])
  expect(plans).toEqual(before)
})
