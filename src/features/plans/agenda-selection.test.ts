import { expect, test } from "bun:test"
import {
  groupAgendaPlans,
  selectAgendaPlans,
} from "@/features/plans/agenda-selection"
import { applyPlanCommand } from "@/lib/calendar/plan-command"
import type { PlanDraft, PlanVariant } from "@/types/plan-item"
import type { ItemView, Tag } from "@/types/preferences"

const now = "2026-10-10T09:00:00.000Z"
const id = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`
function plan(
  variant: PlanVariant,
  value: number,
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
      itemId: id(value),
      input: {
        kind: "plan",
        variant,
        title: variant,
        description: "",
        schedule,
        status: "in_progress",
        checklist: [],
        recurrence: null,
      },
    },
    "owner",
    now
  )
}
const metadata = {
  revision: 0,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
}
const tags: Tag[] = [
  {
    id: id(10),
    userId: "owner",
    name: "Later",
    normalizedName: "later",
    color: "#123abc",
    position: 2048,
    ...metadata,
  },
  {
    id: id(11),
    userId: "owner",
    name: "First",
    normalizedName: "first",
    color: "#456def",
    position: 1024,
    ...metadata,
  },
]

test("mixed selection includes intervals, preserves overdue progress and orders variant ties", () => {
  const plans = [
    plan("note", 4),
    plan("appointment", 3),
    plan("event", 2),
    plan("task", 1),
  ]
  expect(
    selectAgendaPlans(plans, { kind: "day", date: "2026-10-11" }).map(
      (record) => record.variant
    )
  ).toEqual(["task", "event", "appointment", "note"])
  expect(
    selectAgendaPlans(plans, { kind: "upcoming", date: "2026-10-11" })
  ).toHaveLength(4)
  expect(
    selectAgendaPlans(plans, { kind: "overdue", date: "2026-10-13" }).map(
      (record) => record.status
    )
  ).toEqual(["in_progress", "in_progress", "in_progress", "in_progress"])
  expect(
    selectAgendaPlans(
      [{ ...plans[0], status: "completed", completedAt: now }],
      { kind: "overdue", date: "2026-10-13" }
    )
  ).toHaveLength(0)
  expect(
    selectAgendaPlans(plans, { kind: "day", date: "2026-10-13" })
  ).toHaveLength(0)
})

test("all selection keeps recurring parents visible and temporal occurrence lists stay explicit", () => {
  const parent = {
    ...plan("note", 1),
    recurrence: {
      frequency: "weekly" as const,
      anchorDate: "2026-10-10",
      timeZone: "Europe/Madrid",
      interval: 1,
      weekdays: [6],
      end: { type: "never" as const },
    },
  }
  expect(selectAgendaPlans([parent], { kind: "all" })).toHaveLength(1)
  expect(
    selectAgendaPlans([parent], { kind: "day", date: "2026-10-10" })
  ).toHaveLength(0)
  expect(
    selectAgendaPlans([{ ...parent, deletedAt: now }], { kind: "all" })
  ).toHaveLength(0)
})

test("grouping keeps every variant together by personal category and category position", () => {
  const plans = [
    plan("note", 4),
    plan("appointment", 3),
    plan("event", 2),
    plan("task", 1),
  ]
  const views: ItemView[] = plans.map((record) => ({
    userId: "owner",
    itemId: record.id,
    primaryTagId: tags[1].id,
    ...metadata,
  }))
  const groups = groupAgendaPlans(plans, tags, views)
  expect(groups).toHaveLength(1)
  expect(groups[0].color).toBe("#456def")
  expect(groups[0].plans.map((record) => record.variant)).toEqual([
    "task",
    "event",
    "appointment",
    "note",
  ])
  views[0].primaryTagId = tags[0].id
  expect(
    groupAgendaPlans(plans, tags, views).map((group) => group.title)
  ).toEqual(["First", "Later"])
  views[0].deletedAt = now
  expect(groupAgendaPlans(plans, tags, views).at(-1)?.title).toBe(
    "Sin categoría"
  )
  expect(
    groupAgendaPlans(
      plans,
      tags.map((tag) => ({ ...tag, deletedAt: now })),
      views
    )
  ).toHaveLength(1)
})
