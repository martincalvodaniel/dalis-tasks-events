import { expect, test } from "bun:test"
import { addCivilDays } from "@/lib/calendar/civil-date"
import { planOccurrencesPage } from "@/lib/calendar/plan-occurrences"
import {
  compareRecurringMovementItems,
  recurringMovementCatalog,
} from "@/lib/preferences/recurring-movement-catalog"
import { planRemoteRecurringTaskPlacementOperation as planMove } from "@/lib/preferences/remote-recurring-task-placement-plan"
import { planRemoteTaskPlacementOperation } from "@/lib/preferences/remote-task-placement-plan"
import { overduePlacementDate } from "@/schemas/ordering"
import { planSchema } from "@/schemas/plan-item"
import type { Plan, PlanVariant } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"
import type { ItemView, Tag, TaskPlacement } from "@/types/preferences"
import type { SyncOperation } from "@/types/sync"

const actor = "recurring-placement-owner"
const now = "2026-10-11T00:00:00.000Z"
const metadata = {
  revision: 1,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
}
function uuid(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
}
function parent(
  index = 1,
  variant: PlanVariant = "task",
  recurring = true
): Plan {
  return planSchema.parse({
    ...metadata,
    id: uuid(index),
    ownerId: actor,
    kind: "plan",
    variant,
    title: "Plan",
    description: "Content",
    status: "not_started",
    completedAt: null,
    checklist: [{ id: uuid(90), text: "Step", completed: false }],
    schedule: {
      mode: "all_day",
      startDate: "2026-10-10",
      endDateExclusive: "2026-10-11",
    },
    recurrence: recurring
      ? {
          frequency: "daily",
          interval: 1,
          anchorDate: "2026-10-10",
          timeZone: "Europe/Madrid",
          end: { type: "never" },
        }
      : null,
  })
}
function exception(series: Plan, date = "2026-10-11"): PlanOccurrence {
  return {
    ...planOccurrencesPage(series, { startDate: date, endDate: date })
      .occurrences[0],
    revision: 1,
  }
}
function fixture(items: Plan[] = [parent()]) {
  const target = items[0]
  const operation: SyncOperation = {
    protocolVersion: 1,
    operationId: crypto.randomUUID(),
    baseRevision: 0,
    command: {
      type: "task.move",
      itemId: target.id,
      occurrenceId: target.recurrence ? `${target.id}:2026-10-11` : null,
      scope: "day",
      date: "2026-10-11",
      tagId: null,
      beforeId: null,
      afterId: null,
    },
  }
  return {
    userId: actor,
    timestamp: now,
    operation,
    items,
    occurrences: [] as PlanOccurrence[],
    tags: [] as Tag[],
    views: [] as ItemView[],
    placements: [] as TaskPlacement[],
  }
}
function command(value: ReturnType<typeof fixture>) {
  if (value.operation.command.type !== "task.move")
    throw new Error("Expected movement")
  return value.operation.command
}
function effects(value: ReturnType<typeof fixture>) {
  const result = planMove(value)
  if (result.status !== "changes")
    throw new Error(`Expected changes, received ${result.status}`)
  return result.effects
}
function catalog(value: ReturnType<typeof fixture>) {
  return recurringMovementCatalog(
    value.items,
    value.occurrences,
    actor,
    command(value)
  )
}

test("mixed default order uses date, time, variant and original identity with four presentations", () => {
  const items = (["note", "appointment", "event", "task"] as const).map(
    (variant, index) => parent(index + 1, variant)
  )
  items.push({
    ...parent(5, "note", false),
    schedule: {
      mode: "all_day",
      startDate: "2026-10-11",
      endDateExclusive: "2026-10-12",
    },
  })
  const value = fixture(items)
  const ordered = catalog(value).toSorted(compareRecurringMovementItems)
  expect(ordered.map((item) => item.variant)).toEqual([
    "task",
    "event",
    "appointment",
    "note",
    "note",
  ])
  command(value).beforeId = ordered[0].id
  const original = JSON.stringify(value)
  const changed = effects(value)
  const placements = changed.flatMap((effect) =>
    effect.store === "taskPlacements" ? [effect.record] : []
  )
  expect(placements).toHaveLength(5)
  expect(
    placements.toSorted((a, b) => a.position - b.position)[0].occurrenceId
  ).toBe(`${items[0].id}:2026-10-11`)
  expect(JSON.stringify(value)).toBe(original)
  const { occurrences, ...activeInput } = value
  expect(planRemoteTaskPlacementOperation(activeInput, true)).toEqual({
    status: "unsupported",
  })
})

test("position CAS and category view advance independently of parent and appearance revisions", () => {
  const value = fixture()
  value.items[0].revision = 8
  value.occurrences = [{ ...exception(value.items[0]), revision: 6 }]
  value.placements = [
    {
      ...metadata,
      revision: 3,
      userId: actor,
      occurrenceId: value.occurrences[0].id,
      scope: "day",
      date: command(value).date,
      tagId: null,
      position: 0,
    },
  ]
  expect(planMove(value)).toEqual({
    status: "conflict",
    current: value.placements[0],
  })
  value.operation.baseRevision = 3
  value.views = [
    {
      ...metadata,
      revision: 5,
      userId: actor,
      itemId: value.items[0].id,
      primaryTagId: uuid(20),
    },
  ]
  value.tags = [
    {
      ...metadata,
      userId: actor,
      id: uuid(20),
      name: "Work",
      normalizedName: "work",
      color: "#123456",
      position: 0,
    },
  ]
  const original = JSON.stringify(value)
  expect(effects(value).map((effect) => effect.record.revision)).toEqual([4, 6])
  expect(JSON.stringify(value)).toBe(original)
  value.placements[0].deletedAt = now
  expect(planMove(value).status).toBe("conflict")
  value.placements = []
  expect(planMove(value).status).toBe("unavailable")
})

test("reprogrammed exceptions keep original identity and suppress cancelled or deleted slots", () => {
  const value = fixture()
  const series = value.items[0]
  const moved = {
    ...exception(series, "2026-10-10"),
    schedule: {
      mode: "all_day" as const,
      startDate: "2026-11-01",
      endDateExclusive: "2026-11-02",
    },
  }
  value.occurrences = [
    moved,
    { ...exception(series), cancelled: true },
    { ...exception(series, "2026-10-12"), deletedAt: now },
  ]
  expect(planMove(value).status).toBe("invalid_command")
  command(value).date = "2026-10-10"
  command(value).occurrenceId = moved.id
  expect(planMove(value).status).toBe("invalid_command")
  command(value).date = "2026-11-01"
  command(value).beforeId = `${series.id}:2026-11-01`
  expect(
    effects(value).some(
      (effect) =>
        effect.store === "taskPlacements" &&
        effect.record.occurrenceId === moved.id
    )
  ).toBe(true)
  expect(catalog(value).filter((item) => item.id === moved.id)).toHaveLength(1)
})

test("overdue uses the declared civil day, permanent sentinel and appearance completion", () => {
  const value = fixture()
  command(value).scope = "overdue"
  command(value).date = "2026-10-13"
  value.timestamp = "2027-12-31T22:00:00.000Z"
  value.occurrences = [
    {
      ...exception(value.items[0], "2026-10-10"),
      status: "completed",
      completedAt: now,
    },
  ]
  command(value).beforeId = `${value.items[0].id}:2026-10-12`
  expect(catalog(value).map((item) => item.id)).toEqual([
    `${value.items[0].id}:2026-10-11`,
    `${value.items[0].id}:2026-10-12`,
  ])
  const changed = effects(value)
  expect(
    changed
      .filter((effect) => effect.store === "taskPlacements")
      .every((effect) => effect.record.date === overduePlacementDate)
  ).toBe(true)
  expect(
    changed.every((effect) => effect.record.updatedAt === value.timestamp)
  ).toBe(true)
})

test("multi-day siblings follow the parent's category when movement changes groups", () => {
  const series = parent()
  series.schedule = {
    mode: "all_day",
    startDate: "2026-10-10",
    endDateExclusive: "2026-10-13",
  }
  const peer = {
    ...parent(2, "appointment", false),
    schedule: {
      mode: "all_day" as const,
      startDate: "2026-10-11",
      endDateExclusive: "2026-10-12",
    },
  }
  const value = fixture([series, peer])
  value.tags = [
    {
      ...metadata,
      userId: actor,
      id: uuid(20),
      name: "Work",
      normalizedName: "work",
      color: "#123456",
      position: 0,
    },
  ]
  value.views = [
    { ...metadata, userId: actor, itemId: peer.id, primaryTagId: uuid(20) },
  ]
  command(value).tagId = uuid(20)
  command(value).beforeId = peer.id
  command(value).afterId = `${series.id}:2026-10-10`
  const changed = effects(value)
  expect(
    changed
      .filter((effect) => effect.store === "taskPlacements")
      .map((effect) => effect.record.occurrenceId)
      .toSorted()
  ).toEqual(
    [`${series.id}:2026-10-10`, `${series.id}:2026-10-11`, peer.id].toSorted()
  )
  expect(
    changed.find((effect) => effect.store === "itemViews")?.record
  ).toMatchObject({ itemId: series.id, primaryTagId: uuid(20), revision: 1 })
})

test("wrong neighbors, parent, category and unresolved DST slots yield no partial effects", () => {
  const value = fixture()
  command(value).beforeId = uuid(99)
  expect(planMove(value).status).toBe("invalid_command")
  command(value).beforeId = null
  command(value).occurrenceId = `${uuid(99)}:2026-10-11`
  expect(planMove(value).status).toBe("invalid_command")
  command(value).occurrenceId = `${value.items[0].id}:2026-10-11`
  command(value).tagId = uuid(99)
  expect(planMove(value).status).toBe("invalid_command")
  command(value).tagId = null
  const series = value.items[0]
  series.schedule = {
    mode: "timed",
    localStart: "2026-03-28T02:30",
    localEnd: "2026-03-28T03:30",
    timeZone: "Europe/Madrid",
  }
  if (!series.recurrence) throw new Error("Expected series")
  series.recurrence.anchorDate = "2026-03-28"
  command(value).date = "2026-03-29"
  command(value).occurrenceId = `${series.id}:2026-03-29T02:30`
  expect(planMove(value).status).toBe("invalid_command")
})

test("complete input rejects foreign, duplicate, orphan, unconfirmed and oversized records", () => {
  const value = fixture()
  value.occurrences = [exception(value.items[0])]
  const valid = structuredClone(value)
  value.items[0].ownerId = "foreign"
  expect(() => planMove(value)).toThrow()
  value.items[0].ownerId = actor
  value.occurrences.push(value.occurrences[0])
  expect(() => planMove(value)).toThrow()
  value.occurrences = [
    {
      ...valid.occurrences[0],
      seriesId: uuid(99),
      id: `${uuid(99)}:2026-10-11`,
    },
  ]
  expect(() => planMove(value)).toThrow()
  value.occurrences = [{ ...valid.occurrences[0], revision: 0 }]
  expect(() => planMove(value)).toThrow()
  expect(planMove(value, true).status).toBe("changes")
  value.occurrences = []
  value.items = Array.from({ length: 10001 }, (_, index) => parent(index + 1))
  expect(() => planMove(value)).toThrow()
})

test("large overdue pagination is complete and generated overflow rejects the whole movement", () => {
  const value = fixture()
  command(value).scope = "overdue"
  command(value).date = "2028-03-01"
  const selected = catalog(value)
  expect(selected.length).toBeGreaterThan(500)
  expect(new Set(selected.map((item) => item.id)).size).toBe(selected.length)
  command(value).date = addCivilDays("2026-10-10", 10000)
  expect(catalog(value)).toHaveLength(10000)
  command(value).date = addCivilDays(command(value).date, 1)
  expect(() => catalog(value)).toThrow("exceeds its limit")
  expect(planMove(value).status).toBe("invalid_command")
})

test("manual ranks govern mixed peers and a deleted peer placement cannot be resurrected", () => {
  const value = fixture([parent(1), parent(2, "note"), parent(3, "event")])
  value.placements = [2, 3].map((id, index) => ({
    ...metadata,
    userId: actor,
    occurrenceId: `${uuid(id)}:2026-10-11`,
    scope: "day",
    date: "2026-10-11",
    tagId: null,
    position: index * 1024,
  }))
  command(value).beforeId = value.placements[1].occurrenceId
  command(value).afterId = value.placements[0].occurrenceId
  const changed = effects(value)
  const primary = changed.find(
    (effect) =>
      effect.store === "taskPlacements" &&
      effect.record.occurrenceId === `${uuid(1)}:2026-10-11`
  )
  expect(primary?.record).toMatchObject({ position: 512, revision: 1 })
  expect(
    changed.filter((effect) => effect.store === "taskPlacements")
  ).toHaveLength(1)
  value.placements[0].deletedAt = now
  expect(planMove(value).status).toBe("invalid_command")
})

test("simple targets can order next to recurring peers and timed starts precede variant ties", () => {
  const simple = {
    ...parent(1, "note", false),
    schedule: {
      mode: "all_day" as const,
      startDate: "2026-10-11",
      endDateExclusive: "2026-10-12",
    },
  }
  const early = parent(2, "note")
  early.schedule = {
    mode: "timed",
    localStart: "2026-10-10T09:00",
    localEnd: "2026-10-10T09:30",
    timeZone: "Europe/Madrid",
  }
  const later = parent(3, "task")
  later.schedule = {
    mode: "timed",
    localStart: "2026-10-10T10:00",
    localEnd: "2026-10-10T10:30",
    timeZone: "Europe/Madrid",
  }
  const value = fixture([simple, early, later])
  const ordered = catalog(value).toSorted(compareRecurringMovementItems)
  expect(ordered.map((item) => item.id)).toEqual([
    simple.id,
    `${early.id}:2026-10-11T09:00`,
    `${later.id}:2026-10-11T10:00`,
  ])
  command(value).afterId = ordered[2].id
  expect(
    effects(value).filter((effect) => effect.store === "taskPlacements")
  ).toHaveLength(3)
  early.recurrence = early.recurrence
    ? { ...early.recurrence, end: { type: "count", count: 1 } }
    : null
  value.occurrences = [
    {
      ...exception(later),
      seriesId: early.id,
      id: `${early.id}:2026-10-11T10:00`,
    },
  ]
  expect(
    catalog(value).some((item) => item.id === `${early.id}:2026-10-11T10:00`)
  ).toBe(true)
})
