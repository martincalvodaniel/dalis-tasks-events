import { expect, test } from "bun:test"
import { applyPlanCommand } from "@/lib/calendar/plan-command"
import {
  comparePlans,
  isPlanOverdue,
  planDueDate,
  planIncludesDate,
} from "@/lib/calendar/plan-selection"
import type { PlanDraft, PlanVariant } from "@/types/plan-item"

function makePlan(
  variant: PlanVariant,
  schedule: PlanDraft["schedule"] = {
    mode: "all_day",
    startDate: "2026-10-10",
    endDateExclusive: "2026-10-13",
  }
) {
  return applyPlanCommand(
    null,
    {
      type: "item.create",
      itemId: "b2d10a29-73af-4b53-a753-53e4dba1b110",
      input: {
        kind: "plan",
        variant,
        title: "Plan",
        description: "",
        schedule,
        status: "in_progress",
        checklist: [],
        recurrence: null,
      },
    },
    "owner",
    "2026-10-10T09:00:00.000Z"
  )
}
test("all variants share inclusive day intervals and retain progress when overdue", () => {
  for (const variant of ["task", "event", "appointment", "note"] as const) {
    const plan = makePlan(variant)
    expect(planDueDate(plan)).toBe("2026-10-12")
    expect(planIncludesDate(plan, "2026-10-09")).toBe(false)
    for (const day of ["2026-10-10", "2026-10-11", "2026-10-12"])
      expect(planIncludesDate(plan, day)).toBe(true)
    expect(planIncludesDate(plan, "2026-10-13")).toBe(false)
    expect(isPlanOverdue(plan, "2026-10-12")).toBe(false)
    expect(isPlanOverdue(plan, "2026-10-13")).toBe(true)
    expect(plan.status).toBe("in_progress")
    expect(
      isPlanOverdue(
        {
          ...plan,
          status: "completed",
          completedAt: "2026-10-10T09:00:00.000Z",
        },
        "2026-10-13"
      )
    ).toBe(false)
    expect(
      planIncludesDate(
        { ...plan, deletedAt: "2026-10-10T09:00:00.000Z" },
        "2026-10-10"
      )
    ).toBe(false)
  }
})
test("timed plans include their last civil date and have a start-only fallback", () => {
  const plan = makePlan("note", {
    mode: "timed",
    localStart: "2026-10-10T23:00",
    localEnd: "2026-10-11T01:00",
    timeZone: "Europe/Madrid",
  })
  expect(planDueDate(plan)).toBe("2026-10-11")
  expect(planIncludesDate(plan, "2026-10-11")).toBe(true)
  expect(isPlanOverdue(plan, "2026-10-12")).toBe(true)
  expect(
    planDueDate(
      makePlan("appointment", {
        mode: "timed",
        localStart: "2026-10-10T23:00",
        localEnd: null,
        timeZone: "Europe/Madrid",
      })
    )
  ).toBe("2026-10-10")
})
test("default order compares date and time, then presentation and identity", () => {
  const plans = [
    makePlan("note"),
    makePlan("appointment"),
    makePlan("event"),
    makePlan("task"),
  ]
  expect(plans.toSorted(comparePlans).map((plan) => plan.variant)).toEqual([
    "task",
    "event",
    "appointment",
    "note",
  ])
  const timed = makePlan("task", {
    mode: "timed",
    localStart: "2026-10-10T08:00",
    localEnd: null,
    timeZone: "Europe/Madrid",
  })
  expect(comparePlans(plans[0], timed)).toBeLessThan(0)
  const later = makePlan("task", {
    mode: "timed",
    localStart: "2026-10-10T09:00",
    localEnd: null,
    timeZone: "Europe/Madrid",
  })
  expect(comparePlans(timed, later)).toBeLessThan(0)
  const peer = { ...timed, id: "b2d10a29-73af-4b53-a753-53e4dba1b111" }
  expect(comparePlans(timed, peer)).toBeLessThan(0)
  expect(comparePlans(timed, timed)).toBe(0)
})
