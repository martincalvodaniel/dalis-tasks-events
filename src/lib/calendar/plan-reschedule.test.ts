import { expect, test } from "bun:test"
import { applyPlanCommand } from "@/lib/calendar/plan-command"
import { rescheduledPlanInput } from "@/lib/calendar/plan-reschedule"
import type { Plan } from "@/types/plan-item"

function plan(variant: Plan["variant"]): Plan {
  return applyPlanCommand(
    null,
    {
      type: "item.create",
      itemId: "00000000-0000-4000-8000-000000000001",
      input: {
        kind: "plan",
        variant,
        title: "Move",
        description: "Preserved",
        status: "completed",
        checklist: [
          {
            id: "00000000-0000-4000-8000-000000000002",
            text: "Step",
            completed: true,
          },
        ],
        recurrence: null,
        schedule: {
          mode: "all_day",
          startDate: "2026-10-10",
          endDateExclusive: "2026-10-13",
        },
      },
    },
    "owner",
    "2026-10-10T09:00:00.000Z"
  )
}

test("all variants move their civil interval and preserve progress and checklist", () => {
  for (const variant of ["task", "event", "appointment", "note"] as const) {
    const original = plan(variant),
      before = JSON.stringify(original)
    const moved = rescheduledPlanInput(original, "2026-12-30")
    expect(moved.schedule).toEqual({
      mode: "all_day",
      startDate: "2026-12-30",
      endDateExclusive: "2027-01-02",
    })
    expect(moved).toMatchObject({
      variant,
      status: "completed",
      checklist: original.checklist,
      description: original.description,
    })
    expect(JSON.stringify(original)).toBe(before)
  }
})

test("timed moves preserve civil endpoints and zone across DST", () => {
  const original = {
    ...plan("appointment"),
    schedule: {
      mode: "timed" as const,
      localStart: "2026-10-24T14:30",
      localEnd: "2026-10-25T16:00",
      timeZone: "Europe/Madrid",
    },
  }
  expect(rescheduledPlanInput(original, "2026-10-25").schedule).toEqual({
    mode: "timed",
    localStart: "2026-10-25T14:30",
    localEnd: "2026-10-26T16:00",
    timeZone: "Europe/Madrid",
  })
  expect(
    rescheduledPlanInput(
      { ...original, schedule: { ...original.schedule, localEnd: null } },
      "2026-10-27"
    ).schedule
  ).toMatchObject({ localStart: "2026-10-27T14:30", localEnd: null })
  const early = {
    ...original,
    schedule: {
      ...original.schedule,
      localStart: "2026-10-24T02:30",
      localEnd: null,
    },
  }
  expect(() => rescheduledPlanInput(early, "2026-10-25")).toThrow()
  expect(() => rescheduledPlanInput(early, "2026-03-29")).toThrow()
})

test("invalid dates, overflow, deleted plans and whole series do not produce updates", () => {
  const original = plan("note")
  expect(() => rescheduledPlanInput(original, "2026-02-30")).toThrow()
  expect(() => rescheduledPlanInput(original, "9999-12-31")).toThrow()
  expect(() =>
    rescheduledPlanInput(
      { ...original, deletedAt: original.updatedAt },
      "2026-10-12"
    )
  ).toThrow()
  expect(() =>
    rescheduledPlanInput(
      {
        ...original,
        recurrence: {
          frequency: "daily",
          interval: 1,
          anchorDate: "2026-10-10",
          timeZone: "Europe/Madrid",
          end: { type: "count", count: 3 },
        },
      },
      "2026-10-12"
    )
  ).toThrow()
})
