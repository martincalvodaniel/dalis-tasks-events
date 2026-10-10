import { expect, test } from "bun:test"
import { resolveEventSchedule } from "@/lib/calendar/event-time"
import {
  type PlanOccurrencePage,
  planOccurrencesPage,
} from "@/lib/calendar/plan-occurrences"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import type { Plan, PlanVariant } from "@/types/plan-item"

const id = "00000000-0000-4000-8000-000000000001"
const stepId = "00000000-0000-4000-8000-000000000002"
const now = "2026-10-10T09:00:00.000Z"
const variants: PlanVariant[] = ["task", "event", "appointment", "note"]
function parent(
  variant: PlanVariant = "task",
  schedule: Plan["schedule"] = {
    mode: "all_day",
    startDate: "2026-10-10",
    endDateExclusive: "2026-10-12",
  }
): Plan {
  return planSchema.parse({
    kind: "plan",
    variant,
    id,
    ownerId: "occurrence-owner",
    title: "Recurring plan",
    description: "Details",
    status: "completed",
    completedAt: now,
    checklist: [{ id: stepId, text: "Independent step", completed: true }],
    schedule,
    recurrence: {
      frequency: "daily",
      anchorDate:
        schedule.mode === "all_day"
          ? schedule.startDate
          : schedule.localStart.slice(0, 10),
      timeZone: schedule.mode === "timed" ? schedule.timeZone : "Europe/Madrid",
      interval: 1,
      end: { type: "never" },
    },
    revision: 8,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
}
const query = (startDate: string, endDate = startDate, limit = 100) => ({
  startDate,
  endDate,
  limit,
})

test("four variants share stable slots, civil length and independent initial progress", () => {
  let reference: PlanOccurrencePage | undefined
  for (const variant of variants) {
    const series = parent(variant)
    const original = structuredClone(series)
    const page = planOccurrencesPage(series, query("2026-10-11", "2026-10-12"))
    expect(page.occurrences).toHaveLength(2)
    expect(page.issues).toEqual([])
    expect(page.occurrences[0]).toMatchObject({
      id: `${id}:2026-10-11`,
      slotKey: "2026-10-11",
      seriesId: id,
      kind: "plan",
      schedule: {
        mode: "all_day",
        startDate: "2026-10-11",
        endDateExclusive: "2026-10-13",
      },
      status: "not_started",
      completedAt: null,
      revision: 0,
      checklist: [{ id: stepId, completed: false }],
    })
    if (reference) expect(page).toEqual(reference)
    reference = structuredClone(page)
    page.occurrences[0].checklist[0].completed = true
    page.occurrences[0].checklist[0].text = "Edited occurrence"
    expect(page.occurrences[1].checklist[0].completed).toBe(false)
    expect(series).toEqual(original)
  }
})

test("page size, original date cursor and count limits remain authoritative", () => {
  const series = parent()
  if (!series.recurrence) throw new Error("Fixture recurrence is required")
  series.recurrence.end = { type: "count", count: 3 }
  const first = planOccurrencesPage(
    series,
    query("2026-10-10", "2026-10-20", 1)
  )
  expect(first.nextAfter).toBe("2026-10-10")
  const second = planOccurrencesPage(series, {
    ...query("2026-10-10", "2026-10-20", 1),
    afterDate: first.nextAfter,
  })
  const third = planOccurrencesPage(series, {
    ...query("2026-10-10", "2026-10-20", 1),
    afterDate: second.nextAfter,
  })
  expect(
    [first, second, third].flatMap((page) =>
      page.occurrences.map((record) => record.slotKey)
    )
  ).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"])
  expect(third.nextAfter).toBeNull()
  expect(() =>
    planOccurrencesPage(series, query("2026-10-10", "2026-10-20", 501))
  ).toThrow()
  expect(() =>
    planOccurrencesPage(series, {
      ...query("2026-10-10"),
      afterDate: "2026-10-09",
    })
  ).toThrow()
})

test("weekly selection and excluded calendar dates do not depend on the visual variant", () => {
  for (const variant of variants) {
    const series = parent(variant)
    if (!series.recurrence) throw new Error("Fixture recurrence is required")
    series.recurrence = {
      ...series.recurrence,
      frequency: "weekly",
      weekdays: [1, 3],
      end: { type: "until", date: "2026-10-15" },
    }
    expect(
      planOccurrencesPage(
        series,
        query("2026-10-10", "2026-10-20")
      ).occurrences.map((record) => record.slotKey)
    ).toEqual(["2026-10-12", "2026-10-14"])
  }
})

test("timed slots retain wall clock endpoints and day offsets across DST", () => {
  const series = parent("appointment", {
    mode: "timed",
    localStart: "2026-03-28T01:30",
    localEnd: "2026-03-28T03:30",
    timeZone: "Europe/Madrid",
  })
  const page = planOccurrencesPage(series, query("2026-03-28", "2026-03-29"))
  expect(page.issues).toEqual([])
  expect(page.occurrences.map((record) => record.id)).toEqual([
    `${id}:2026-03-28T01:30`,
    `${id}:2026-03-29T01:30`,
  ])
  expect(
    page.occurrences.map((record) => {
      const resolved = resolveEventSchedule(record.schedule)
      return resolved.mode === "timed" ? resolved.durationMilliseconds : null
    })
  ).toEqual([7200000, 3600000])
  const overnight = parent("note", {
    mode: "timed",
    localStart: "2026-10-10T23:00",
    localEnd: "2026-10-12T01:00",
    timeZone: "Europe/Madrid",
  })
  expect(
    planOccurrencesPage(overnight, query("2026-10-11")).occurrences[0].schedule
  ).toMatchObject({
    localStart: "2026-10-11T23:00",
    localEnd: "2026-10-13T01:00",
  })
})

test("DST gaps and folds are explicit issues and consume the original pagination slot", () => {
  for (const [anchor, invalid, reason] of [
    ["2026-03-28", "2026-03-29", "nonexistent"],
    ["2026-10-24", "2026-10-25", "ambiguous"],
  ] as const) {
    const series = parent("event", {
      mode: "timed",
      localStart: `${anchor}T02:30`,
      localEnd: null,
      timeZone: "Europe/Madrid",
    })
    const page = planOccurrencesPage(
      series,
      query(
        invalid,
        `${invalid.slice(0, 8)}${String(Number(invalid.slice(8)) + 1).padStart(2, "0")}`,
        1
      )
    )
    expect(page.occurrences).toEqual([])
    expect(page.issues).toEqual([
      {
        id: `${id}:${invalid}T02:30`,
        seriesId: id,
        slotKey: `${invalid}T02:30`,
        reason,
      },
    ])
    expect(page.nextAfter).toBe(invalid)
    const next = planOccurrencesPage(series, {
      ...query(
        invalid,
        `${invalid.slice(0, 8)}${String(Number(invalid.slice(8)) + 1).padStart(2, "0")}`,
        1
      ),
      afterDate: page.nextAfter,
    })
    expect(next.occurrences).toHaveLength(1)
  }
})

test("year boundaries report overflow and retain the slot rather than truncate duration", () => {
  const series = parent()
  const page = planOccurrencesPage(series, query("9999-12-30", "9999-12-31", 1))
  expect(page.occurrences).toEqual([])
  expect(page.issues).toEqual([
    {
      id: `${id}:9999-12-30`,
      seriesId: id,
      slotKey: "9999-12-30",
      reason: "out_of_range",
    },
  ])
  expect(page.nextAfter).toBe("9999-12-30")
  expect(
    planOccurrencesPage(
      parent("task", {
        mode: "all_day",
        startDate: "0001-01-01",
        endDateExclusive: "0001-01-02",
      }),
      query("0001-01-01")
    ).occurrences[0].slotKey
  ).toBe("0001-01-01")
})

test("deleted or non-recurring parents cannot manufacture active occurrences", () => {
  expect(
    planOccurrencesPage({ ...parent(), deletedAt: now }, query("2026-10-10"))
  ).toEqual({ occurrences: [], issues: [], nextAfter: null })
  expect(() =>
    planOccurrencesPage({ ...parent(), recurrence: null }, query("2026-10-10"))
  ).toThrow("recurring series")
})

test("occurrence validation preserves identity and coherent completion without variant data", () => {
  const record = planOccurrencesPage(parent(), query("2026-10-10"))
    .occurrences[0]
  expect(
    planOccurrenceSchema.safeParse({
      ...record,
      status: "completed",
      completedAt: now,
    }).success
  ).toBe(true)
  for (const invalid of [
    { ...record, id: `${id}:2026-10-11` },
    { ...record, seriesId: crypto.randomUUID() },
    { ...record, status: "completed" },
    { ...record, completedAt: now },
    { ...record, variant: "note" },
    { ...record, checklist: [record.checklist[0], record.checklist[0]] },
  ])
    expect(planOccurrenceSchema.safeParse(invalid).success).toBe(false)
})
