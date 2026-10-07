import { expect, test } from "bun:test"
import { parseEventForm } from "@/features/events/event-form-input"

function fields(overrides: Record<string, string> = {}) {
  const form = new FormData()
  for (const [name, value] of Object.entries({
    title: "Test event",
    description: "Kept details",
    localStart: "2026-10-07T23:30",
    localEnd: "",
    timeZone: "Europe/Madrid",
    startDate: "2026-10-07",
    lastDate: "2026-10-08",
    ...overrides,
  }))
    form.set(name, value)
  return form
}

test("event form converts inclusive all-day dates and ignores inactive timed fields", () => {
  const parsed = parseEventForm(
    fields({ allDay: "on", localStart: "invalid", timeZone: "invalid" })
  )
  expect(parsed.success).toBe(true)
  if (parsed.success)
    expect(parsed.data).toMatchObject({
      description: "Kept details",
      schedule: {
        mode: "all_day",
        startDate: "2026-10-07",
        endDateExclusive: "2026-10-09",
      },
    })
  expect(
    parseEventForm(fields({ allDay: "on", lastDate: "2026-10-06" })).success
  ).toBe(false)
  expect(
    parseEventForm(
      fields({ allDay: "on", startDate: "9999-12-31", lastDate: "9999-12-31" })
    ).success
  ).toBe(false)
})

test("event form treats blank end as a point and validates gaps, folds and inactive all-day dates", () => {
  const parsed = parseEventForm(
    fields({ startDate: "invalid", lastDate: "invalid" })
  )
  expect(parsed.success).toBe(true)
  if (parsed.success)
    expect(parsed.data.schedule).toMatchObject({
      mode: "timed",
      localEnd: null,
    })
  for (const [localStart, reason] of [
    ["2026-03-29T02:30", "nonexistent"],
    ["2026-10-25T02:30", "ambiguous"],
  ]) {
    const result = parseEventForm(fields({ localStart }))
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error.issues[0]).toMatchObject({
        params: { timeReason: reason },
      })
  }
})
