import { describe, expect, test } from "bun:test"
import {
  createPlanAgendaRows,
  groupPlanAgendaRows,
  orderPlanAgendaRows,
  planAppearanceRange,
} from "@/features/plans/plan-agenda-rows"
import type { PlanOccurrenceView } from "@/lib/calendar/plan-occurrence-selection"
import { planOccurrencesPage } from "@/lib/calendar/plan-occurrences"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import {
  itemViewSchema,
  tagSchema,
  taskPlacementSchema,
} from "@/schemas/preferences"
import type { Plan, PlanVariant } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"

const now = "2026-10-10T14:00:00.000Z"
const owner = "agenda-owner"
const metadata = {
  revision: 0,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
}
function uuid(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
}
function plan(
  index = 1,
  variant: PlanVariant = "task",
  recurring = true
): Plan {
  return planSchema.parse({
    kind: "plan",
    variant,
    id: uuid(index),
    ownerId: owner,
    title: "Parent title",
    description: "Parent details",
    status: "not_started",
    completedAt: null,
    checklist: [{ id: uuid(99), text: "Parent step", completed: false }],
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
          end: { type: "never" },
        }
      : null,
    ...metadata,
  })
}
function appearance(
  parent: Plan,
  exception?: PlanOccurrence
): PlanOccurrenceView {
  const occurrence =
    exception ??
    planOccurrencesPage(parent, {
      startDate: "2026-10-10",
      endDate: "2026-10-10",
    }).occurrences[0]
  return {
    seriesId: parent.id,
    variant: parent.variant,
    title: occurrence.content?.title ?? parent.title,
    description: occurrence.content?.description ?? parent.description,
    occurrence,
  }
}
const day = { kind: "day", date: "2026-10-11" } as const

describe("common plan agenda appearance rows", () => {
  test("four variants mix with simple items and retain original slot keys and canonical parents", () => {
    const variants = ["note", "appointment", "event", "task"] as const
    const parents = variants.map((variant, index) => plan(index + 1, variant))
    const simple = plan(5, "note", false)
    const original = structuredClone(parents)
    const views = parents.map((parent) => appearance(parent))
    const rows = createPlanAgendaRows([...parents, simple], views, day)
    expect(rows.map((row) => row.plan.variant)).toEqual([
      "task",
      "event",
      "appointment",
      "note",
      "note",
    ])
    for (const row of rows.filter((row) => row.occurrence)) {
      if (!row.occurrence) throw new Error("Expected an occurrence row")
      expect(row.key).toBe(row.occurrence.id)
      expect(row.plan.id).toBe(row.series.id)
      expect(row.plan.recurrence).toBeNull()
      expect(row.series.recurrence).not.toBeNull()
      expect(row.plan.schedule).toEqual(row.occurrence.schedule)
    }
    rows[0].plan.title = "Edited display"
    rows[0].plan.checklist[0].text = "Edited step"
    expect(parents).toEqual(original)
    expect(rows[0].series.title).toBe("Parent title")
    expect(rows[0].occurrence?.checklist[0].text).toBe("Parent step")
  })
  test("category grouping uses parent assignment and exposes current category color", () => {
    const parent = plan()
    const simple = plan(2, "note", false)
    const rows = createPlanAgendaRows(
      [parent, simple],
      [appearance(parent)],
      day
    )
    const tag = tagSchema.parse({
      id: uuid(50),
      userId: owner,
      name: "Casa",
      normalizedName: "casa",
      color: "#123abc",
      position: 1024,
      ...metadata,
    })
    const view = itemViewSchema.parse({
      userId: owner,
      itemId: parent.id,
      primaryTagId: tag.id,
      ...metadata,
    })
    const groups = groupPlanAgendaRows(rows, [tag], [view])
    expect(
      groups.map((group) => ({
        id: group.id,
        title: group.title,
        color: group.color,
      }))
    ).toEqual([
      { id: tag.id, title: "Casa", color: tag.color },
      { id: "uncategorized", title: "Sin categoría", color: null },
    ])
    expect(groups[0].rows[0].key).toBe(`${parent.id}:2026-10-10`)
    groups[0].rows[0].series.title = "Group edit"
    expect(rows.find((row) => row.series.id === parent.id)?.series.title).toBe(
      "Parent title"
    )
    expect(
      groupPlanAgendaRows(rows, [{ ...tag, deletedAt: now }], [view])
    ).toHaveLength(1)
    expect(
      groupPlanAgendaRows(rows, [tag], [{ ...view, deletedAt: now }])[0].id
    ).toBe("uncategorized")
  })
  test("interval selection includes carryover and excludes completed overdue appearances", () => {
    const parent = plan()
    const current = appearance(parent).occurrence
    const completed = planOccurrenceSchema.parse({
      ...current,
      status: "completed",
      completedAt: now,
    })
    expect(
      createPlanAgendaRows([parent], [appearance(parent)], day)
    ).toHaveLength(1)
    expect(
      createPlanAgendaRows([parent], [appearance(parent)], {
        kind: "day",
        date: "2026-10-12",
      })
    ).toEqual([])
    expect(
      createPlanAgendaRows([parent], [appearance(parent)], {
        kind: "overdue",
        date: "2026-10-12",
      })
    ).toHaveLength(1)
    expect(
      createPlanAgendaRows([parent], [appearance(parent, completed)], {
        kind: "overdue",
        date: "2026-10-12",
      })
    ).toEqual([])
    expect(
      createPlanAgendaRows([parent], [appearance(parent, completed)], day)
    ).toHaveLength(1)
    expect(
      createPlanAgendaRows([parent], [appearance(parent)], {
        kind: "upcoming",
        date: "2026-10-11",
      })
    ).toHaveLength(1)
    expect(
      createPlanAgendaRows([parent], [appearance(parent)], {
        kind: "upcoming",
        date: "2026-10-12",
      })
    ).toEqual([])
  })
  test("overrides display content/progress without replacing canonical identity or templates", () => {
    const parent = plan()
    const changed = planOccurrenceSchema.parse({
      ...appearance(parent).occurrence,
      content: { title: "Occurrence title", description: "Occurrence details" },
      status: "in_progress",
      checklist: [{ id: uuid(99), text: "Occurrence step", completed: true }],
      schedule: {
        mode: "timed",
        localStart: "2026-10-11T09:00",
        localEnd: "2026-10-11T10:00",
        timeZone: "Europe/Madrid",
      },
    })
    const row = createPlanAgendaRows(
      [parent],
      [appearance(parent, changed)],
      day
    )[0]
    expect(row.plan).toMatchObject({
      id: parent.id,
      title: "Occurrence title",
      description: "Occurrence details",
      status: "in_progress",
      recurrence: null,
      checklist: [{ completed: true }],
    })
    expect(row.series).toEqual(parent)
    expect(row.key).toBe(`${parent.id}:2026-10-10`)
  })
  test("manual occurrence and simple positions are preserved by scope, date and category", () => {
    const parent = plan()
    const simple = plan(2, "event", false)
    const rows = createPlanAgendaRows(
      [parent, simple],
      [appearance(parent)],
      day
    )
    const placement = (
      key: string,
      position: number,
      scope: "day" | "overdue" = "day",
      date: string = day.date
    ) =>
      taskPlacementSchema.parse({
        userId: owner,
        occurrenceId: key,
        scope,
        date,
        tagId: null,
        position,
        ...metadata,
      })
    const manual = [
      placement(simple.id, 10),
      placement(`${parent.id}:2026-10-10`, 20),
    ]
    expect(
      orderPlanAgendaRows(rows, manual, day, null).map((row) => row.key)
    ).toEqual([simple.id, `${parent.id}:2026-10-10`])
    expect(
      orderPlanAgendaRows(rows, manual, day, uuid(50)).map((row) => row.key)
    ).toEqual([`${parent.id}:2026-10-10`, simple.id])
    expect(
      orderPlanAgendaRows(
        rows,
        manual,
        { kind: "day", date: "2026-10-10" },
        null
      ).map((row) => row.key)
    ).toEqual([`${parent.id}:2026-10-10`, simple.id])
    const overdue = [
      placement(simple.id, 10, "overdue", "0001-01-01"),
      placement(`${parent.id}:2026-10-10`, 20, "overdue", "0001-01-01"),
    ]
    expect(
      orderPlanAgendaRows(
        rows,
        overdue,
        { kind: "overdue", date: "2026-10-12" },
        null
      ).map((row) => row.key)
    ).toEqual([simple.id, `${parent.id}:2026-10-10`])
    expect(
      orderPlanAgendaRows(
        rows,
        manual,
        { kind: "upcoming", date: day.date },
        null
      ).map((row) => row.key)
    ).toEqual([`${parent.id}:2026-10-10`, simple.id])
  })
  test("all selection exposes canonical parents only and invalid row identities reject", () => {
    const parent = plan()
    expect(
      createPlanAgendaRows([parent], [appearance(parent)], { kind: "all" })
    ).toMatchObject([
      {
        key: parent.id,
        occurrence: null,
        plan: { recurrence: parent.recurrence },
      },
    ])
    expect(() => createPlanAgendaRows([parent, parent], [], day)).toThrow(
      "Duplicate plan agenda parent"
    )
    expect(() =>
      createPlanAgendaRows(
        [parent],
        [appearance(parent), appearance(parent)],
        day
      )
    ).toThrow("Duplicate plan agenda row")
    expect(() => createPlanAgendaRows([], [appearance(parent)], day)).toThrow(
      "matching recurring parent"
    )
    expect(
      createPlanAgendaRows(
        [parent],
        [
          appearance(parent, {
            ...appearance(parent).occurrence,
            cancelled: true,
          }),
        ],
        day
      )
    ).toEqual([])
  })
  test("overdue range uses moved current exception dates before the recurrence anchor", () => {
    const parent = plan()
    const moved = planOccurrenceSchema.parse({
      ...appearance(parent).occurrence,
      schedule: {
        mode: "timed",
        localStart: "2026-09-01T09:00",
        localEnd: "2026-09-01T10:00",
        timeZone: "Europe/Madrid",
      },
    })
    expect(
      planAppearanceRange(
        [parent],
        [moved],
        { kind: "overdue", date: "2026-10-10" },
        "2026-12-01"
      )
    ).toEqual({ startDate: "2026-09-01", endDate: "2026-10-09" })
    expect(
      planAppearanceRange(
        [parent],
        [],
        { kind: "overdue", date: "2026-10-10" },
        "2026-12-01"
      )
    ).toBeNull()
    expect(
      planAppearanceRange(
        [parent],
        [],
        { kind: "overdue", date: "0001-01-01" },
        "2026-12-01"
      )
    ).toBeNull()
  })
  test("range selection respects exact days, explicit horizons, inactive parents and civil validation", () => {
    const parent = plan()
    expect(planAppearanceRange([parent], [], day, "2026-12-01")).toEqual({
      startDate: day.date,
      endDate: day.date,
    })
    expect(
      planAppearanceRange(
        [parent],
        [],
        { kind: "upcoming", date: day.date },
        "2026-12-01"
      )
    ).toEqual({ startDate: day.date, endDate: "2026-12-01" })
    expect(
      planAppearanceRange([parent], [], { kind: "all" }, "2026-12-01")
    ).toBeNull()
    expect(
      planAppearanceRange(
        [{ ...parent, deletedAt: now }],
        [],
        day,
        "2026-12-01"
      )
    ).toBeNull()
    expect(
      planAppearanceRange([plan(2, "task", false)], [], day, "2026-12-01")
    ).toBeNull()
    expect(() =>
      planAppearanceRange(
        [parent],
        [],
        { kind: "upcoming", date: day.date },
        "2026-10-10"
      )
    ).toThrow("horizon precedes")
    expect(() =>
      planAppearanceRange(
        [parent],
        [],
        { kind: "day", date: "invalid" },
        "2026-12-01"
      )
    ).toThrow()
    expect(() => planAppearanceRange([parent], [], day, "invalid")).toThrow()
  })
})
