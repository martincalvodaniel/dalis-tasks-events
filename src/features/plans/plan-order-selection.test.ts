import { expect, test } from "bun:test"
import type { PlanAgendaRow } from "@/features/plans/plan-agenda-rows"
import { planRowOrderPeers } from "@/features/plans/plan-order-selection"
import { applyPlanCommand } from "@/lib/calendar/plan-command"

function row(index: number, date = "2026-10-11"): PlanAgendaRow {
  const plan = applyPlanCommand(
    null,
    {
      type: "item.create",
      itemId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      input: {
        kind: "plan",
        variant: "task",
        title: "Plan",
        description: "",
        schedule: {
          mode: "timed",
          localStart: `${date}T14:30`,
          localEnd: null,
          timeZone: "Europe/Madrid",
        },
        status: "not_started",
        checklist: [],
        recurrence: null,
      },
    },
    "owner",
    "2026-10-11T09:00:00.000Z"
  )
  return { key: plan.id, plan, series: plan, occurrence: null }
}

test("upcoming and all preserve same-day peers in displayed manual order", () => {
  const rows = [row(3), row(2), row(4, "2026-10-12"), row(1)]
  for (const selection of [
    { kind: "upcoming", date: "2026-10-11" },
    { kind: "all" },
  ] as const)
    expect(
      planRowOrderPeers(rows, selection, rows[0]).map((plan) => plan.id)
    ).toEqual([rows[0].key, rows[1].key, rows[3].key])
  expect(
    planRowOrderPeers(rows, { kind: "upcoming", date: "2026-10-12" }, rows[0])
  ).toEqual([])
  expect(
    planRowOrderPeers(rows, { kind: "day", date: "2026-10-12" }, rows[0])
  ).toEqual([])
})

test("an appearance blocks only its day context; recurring parents are never peers", () => {
  const first = row(1),
    second = row(2),
    otherDay = row(3, "2026-10-12")
  const recurring = {
    ...row(4),
    series: {
      ...row(4).series,
      recurrence: {
        frequency: "daily" as const,
        interval: 1,
        anchorDate: "2026-10-11",
        timeZone: "Europe/Madrid",
        end: { type: "never" as const },
      },
    },
  }
  const appearance = {
    ...otherDay,
    occurrence: { id: "appearance" },
  } as PlanAgendaRow
  const rows = [first, second, recurring, appearance]
  expect(
    planRowOrderPeers(rows, { kind: "all" }, first).map((plan) => plan.id)
  ).toEqual([first.key, second.key])
  expect(
    planRowOrderPeers(
      rows,
      { kind: "upcoming", date: "2026-10-11" },
      appearance
    )
  ).toEqual([])
  expect(
    planRowOrderPeers(rows, { kind: "overdue", date: "2026-10-13" }, first)
  ).toEqual([])
  expect(planRowOrderPeers(rows, { kind: "all" }, recurring)).toEqual([])
})
