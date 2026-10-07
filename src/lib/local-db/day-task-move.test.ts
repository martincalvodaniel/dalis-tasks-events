import { expect, test } from "bun:test"
import { occurrencesPage } from "@/lib/calendar/occurrences"
import {
  planLocalTaskMove,
  type TaskMoveCommand,
  type TaskMoveSnapshot,
} from "@/lib/local-db/task-move-mutation"
import { orderPlacedTasks } from "@/lib/ordering/task-order"
import { taskSchema } from "@/schemas/calendar-item"
import { itemOccurrenceSchema } from "@/schemas/occurrence"
import { tagSchema } from "@/schemas/preferences"
import { syncCommandSchema } from "@/schemas/sync"

const userId = "day-movement-owner"
const now = "2026-10-07T10:00:00.000Z"
const ids = [
  "10000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
  "30000000-0000-4000-8000-000000000003",
]
const tagId = "40000000-0000-4000-8000-000000000004"
const metadata = {
  revision: 0,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
}
const tasks = ids.map((id) =>
  taskSchema.parse({
    ...metadata,
    id,
    ownerId: userId,
    kind: "task",
    title: "Day task",
    description: "",
    scheduledDate: "2026-10-07",
    status: "not_started",
    checklist: [],
    completedAt: null,
    recurrence: null,
  })
)
const parent = taskSchema.parse({
  ...tasks[2],
  recurrence: {
    frequency: "daily",
    anchorDate: "2026-10-07",
    interval: 1,
    timeZone: "Europe/Madrid",
    end: { type: "count", count: 3 },
  },
})
const generated = occurrencesPage(parent, {
  startDate: "2026-10-07",
  endDate: "2026-10-09",
}).occurrences
const target = generated[0]
if (target?.kind !== "task") throw new Error("Test task occurrence is missing")
const command: TaskMoveCommand = {
  type: "task.move",
  itemId: parent.id,
  occurrenceId: target.id,
  scope: "day",
  date: "2026-10-07",
  tagId: null,
  beforeId: ids[1],
  afterId: ids[0],
}
const snapshot: TaskMoveSnapshot = {
  items: [tasks[0], tasks[1], parent],
  occurrences: [],
  tags: [],
  views: [],
  placements: [],
  settings: null,
}

test("day movement mixes virtual occurrences and simple neighbors without materializing shared data", () => {
  const before = JSON.stringify(snapshot)
  const plan = planLocalTaskMove(snapshot, command, userId, now)
  const candidates = [tasks[0], tasks[1], target]
  expect(
    orderPlacedTasks(candidates, plan.placements, null).map((task) => task.id)
  ).toEqual([ids[0], target.id, ids[1]])
  expect(plan.placements.length).toBe(3)
  expect(plan.view?.itemId).toBe(parent.id)
  expect(JSON.stringify(snapshot)).toBe(before)
  const simpleMove = {
    ...command,
    itemId: ids[1],
    occurrenceId: null,
    beforeId: target.id,
    afterId: ids[0],
  }
  expect(syncCommandSchema.safeParse(simpleMove).success).toBe(true)
  const second = planLocalTaskMove(
    {
      ...snapshot,
      placements: plan.placements,
      views: plan.view ? [plan.view] : [],
    },
    simpleMove,
    userId,
    now
  )
  const merged = new Map(
    plan.placements.map((placement) => [placement.occurrenceId, placement])
  )
  for (const placement of second.placements)
    merged.set(placement.occurrenceId, placement)
  expect(
    orderPlacedTasks(candidates, [...merged.values()], null).map(
      (task) => task.id
    )
  ).toEqual([ids[0], ids[1], target.id])
  expect(() =>
    planLocalTaskMove(snapshot, { ...command, scope: "overdue" }, userId, now)
  ).toThrow()
  for (const neighbor of [
    "missing",
    `${parent.id}:2026-02-30`,
    `${parent.id}:2026-10-07T09:00`,
  ])
    expect(
      syncCommandSchema.safeParse({ ...simpleMove, beforeId: neighbor }).success
    ).toBe(false)
})

test("day identity validation honors cancellations, tombstones, reprogramming and series category semantics", () => {
  const moved = itemOccurrenceSchema.parse({
    ...generated[1],
    scheduledDate: "2026-10-07",
  })
  const tag = tagSchema.parse({
    ...metadata,
    id: tagId,
    userId,
    name: "Work",
    normalizedName: "work",
    color: "#059669",
    position: 0,
  })
  const planned = planLocalTaskMove(
    { ...snapshot, tags: [tag], occurrences: [moved] },
    { ...command, tagId, beforeId: null, afterId: moved.id },
    userId,
    now
  )
  expect(planned.view).toMatchObject({ itemId: parent.id, primaryTagId: tagId })
  expect(
    new Set(planned.placements.map((record) => record.occurrenceId))
  ).toEqual(new Set([target.id, moved.id]))
  expect(planned.placements.every((record) => record.tagId === tagId)).toBe(
    true
  )
  for (const invalid of [
    { ...target, cancelled: true },
    { ...target, deletedAt: now },
    { ...target, scheduledDate: "2026-10-08" },
  ])
    expect(() =>
      planLocalTaskMove(
        { ...snapshot, occurrences: [invalid] },
        command,
        userId,
        now
      )
    ).toThrow()
  expect(() =>
    planLocalTaskMove(
      snapshot,
      { ...command, occurrenceId: `${parent.id}:2026-10-10` },
      userId,
      now
    )
  ).toThrow()
  expect(() =>
    planLocalTaskMove(snapshot, { ...command, itemId: ids[0] }, userId, now)
  ).toThrow()
  expect(() =>
    planLocalTaskMove(
      {
        ...snapshot,
        items: [tasks[0], tasks[1], { ...parent, ownerId: "other-owner" }],
      },
      command,
      userId,
      now
    )
  ).toThrow()
  expect(() =>
    planLocalTaskMove(
      snapshot,
      { ...command, beforeId: `${parent.id}:2026-10-08` },
      userId,
      now
    )
  ).toThrow()
  expect(() =>
    planLocalTaskMove(
      { ...snapshot, tags: [{ ...tag, userId: "other-owner" }] },
      command,
      userId,
      now
    )
  ).toThrow()
})

test("one-day movement reads all exception pages rather than truncating a group at 500", () => {
  const long = taskSchema.parse({
    ...parent,
    scheduledDate: "2020-01-01",
    recurrence: {
      ...parent.recurrence,
      anchorDate: "2020-01-01",
      end: { type: "never" },
    },
  })
  const first = occurrencesPage(long, {
    startDate: "2020-01-01",
    endDate: "2026-10-07",
    limit: 500,
  })
  const second = occurrencesPage(long, {
    startDate: "2020-01-01",
    endDate: "2026-10-07",
    limit: 1,
    afterDate: first.nextAfter,
  })
  const exceptions = [...first.occurrences, ...second.occurrences].map(
    (record) =>
      itemOccurrenceSchema.parse({ ...record, scheduledDate: "2026-10-07" })
  )
  const plan = planLocalTaskMove(
    { ...snapshot, items: [long], occurrences: exceptions },
    {
      ...command,
      occurrenceId: exceptions[0].id,
      beforeId: null,
      afterId: target.id,
    },
    userId,
    now
  )
  expect(plan.placements.length).toBe(502)
  expect(
    new Set(plan.placements.map((record) => record.occurrenceId)).size
  ).toBe(502)
  expect(plan.placements.at(-1)?.scope).toBe("day")
})
