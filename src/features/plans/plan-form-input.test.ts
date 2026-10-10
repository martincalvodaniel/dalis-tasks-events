import { expect, test } from "bun:test"
import { parsePlanForm } from "@/features/plans/plan-form-input"

function fields(overrides: Record<string, string> = {}) {
  const form = new FormData()
  for (const [name, value] of Object.entries({
    variant: "task",
    title: "Common plan",
    description: "Retained content",
    status: "in_progress",
    localStartDate: "2026-10-10",
    localStartTime: "14:30",
    localEndDate: "",
    localEndTime: "",
    timeZone: "Europe/Madrid",
    frequency: "none",
    interval: "1",
    recurrenceEnd: "never",
    ...overrides,
  }))
    form.set(name, value)
  return form
}

const checklist = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    text: "Existing step",
    completed: true,
  },
]

test("each visual variant keeps the same schedule, progress, description and steps", () => {
  for (const variant of ["task", "event", "appointment", "note"]) {
    const result = parsePlanForm(fields({ variant }), checklist)
    expect(result.success).toBe(true)
    if (result.success)
      expect(result.data).toMatchObject({
        kind: "plan",
        variant,
        description: "Retained content",
        status: "in_progress",
        checklist,
        schedule: {
          mode: "timed",
          localStart: "2026-10-10T14:30",
          localEnd: null,
          timeZone: "Europe/Madrid",
        },
      })
  }
})

test("all-day inclusive end ignores hidden hours and allows a blank final date", () => {
  const result = parsePlanForm(
    fields({
      allDay: "on",
      localEndDate: "2026-10-11",
      localStartTime: "invalid",
    }),
    []
  )
  expect(result.success).toBe(true)
  if (result.success)
    expect(result.data.schedule).toEqual({
      mode: "all_day",
      startDate: "2026-10-10",
      endDateExclusive: "2026-10-12",
    })
  const point = parsePlanForm(fields({ allDay: "on", localEndDate: "" }), [])
  expect(point.success).toBe(true)
  if (point.success)
    expect(point.data.schedule).toEqual({
      mode: "all_day",
      startDate: "2026-10-10",
      endDateExclusive: "2026-10-11",
    })
  expect(
    parsePlanForm(fields({ allDay: "on", localEndDate: "2026-10-09" }), [])
      .success
  ).toBe(false)
  expect(
    parsePlanForm(
      fields({ allDay: "on", localStartDate: "9999-12-31", localEndDate: "" }),
      []
    ).success
  ).toBe(false)
})

test("timed plans reject partial ends and civil DST gaps or folds for every variant", () => {
  expect(
    parsePlanForm(fields({ localEndDate: "2026-10-11" }), []).success
  ).toBe(false)
  expect(parsePlanForm(fields({ localEndTime: "16:00" }), []).success).toBe(
    false
  )
  for (const variant of ["task", "event", "appointment", "note"]) {
    for (const [date, reason] of [
      ["2026-03-29", "nonexistent"],
      ["2026-10-25", "ambiguous"],
    ]) {
      const result = parsePlanForm(
        fields({ variant, localStartDate: date, localStartTime: "02:30" }),
        []
      )
      expect(result.success).toBe(false)
      if (!result.success)
        expect(result.error.issues[0]).toMatchObject({
          params: { timeReason: reason },
        })
    }
  }
})

test("toggling all-day retains the same edited dates and timed values", () => {
  const form = fields({
    allDay: "on",
    localStartDate: "2026-11-14",
    localEndDate: "2026-11-15",
    localEndTime: "16:00",
  })
  const allDay = parsePlanForm(form, [])
  expect(allDay.success).toBe(true)
  if (allDay.success)
    expect(allDay.data.schedule).toMatchObject({
      startDate: "2026-11-14",
      endDateExclusive: "2026-11-16",
    })
  form.delete("allDay")
  const timed = parsePlanForm(form, [])
  expect(timed.success).toBe(true)
  if (timed.success)
    expect(timed.data.schedule).toMatchObject({
      localStart: "2026-11-14T14:30",
      localEnd: "2026-11-15T16:00",
    })
})

test("recurrence derives its anchor from active schedule and retains full persisted rule", () => {
  for (const frequency of ["daily", "weekly", "monthly", "yearly"]) {
    const form = fields({
      frequency,
      interval: "3",
      recurrenceEnd: "count",
      count: "9",
    })
    form.append("weekdays", "2")
    form.append("weekdays", "4")
    const result = parsePlanForm(form, checklist)
    expect(result.success).toBe(true)
    if (result.success)
      expect(result.data.recurrence).toMatchObject({
        frequency,
        anchorDate: "2026-10-10",
        timeZone: "Europe/Madrid",
        interval: 3,
        end: { type: "count", count: 9 },
        ...(frequency === "weekly" ? { weekdays: [2, 4] } : {}),
      })
  }
  const until = parsePlanForm(
    fields({
      allDay: "on",
      localStartDate: "2026-11-12",
      localEndDate: "",
      frequency: "monthly",
      recurrenceEnd: "until",
      untilDate: "2027-05-12",
    }),
    []
  )
  expect(until.success).toBe(true)
  if (until.success)
    expect(until.data.recurrence?.anchorDate).toBe("2026-11-12")
  expect(parsePlanForm(fields({ frequency: "weekly" }), []).success).toBe(false)
  expect(
    parsePlanForm(fields({ frequency: "daily", interval: "0" }), []).success
  ).toBe(false)
  expect(
    parsePlanForm(
      fields({
        frequency: "daily",
        recurrenceEnd: "until",
        untilDate: "2026-01-01",
      }),
      []
    ).success
  ).toBe(false)
  expect(
    parsePlanForm(
      fields({ frequency: "daily", recurrenceEnd: "count", count: "NaN" }),
      []
    ).success
  ).toBe(false)
})
