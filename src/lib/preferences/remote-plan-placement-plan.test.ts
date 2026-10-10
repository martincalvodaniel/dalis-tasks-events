import { expect, test } from "bun:test"
import { planRemoteTaskPlacementOperation } from "@/lib/preferences/remote-task-placement-plan"
import { overduePlacementDate } from "@/schemas/ordering"
import { planSchema, planVariantSchema } from "@/schemas/plan-item"
import type { Plan, PlanVariant } from "@/types/plan-item"
import type { TaskPlacement } from "@/types/preferences"
import type { SyncOperation } from "@/types/sync"

const userId = "common-placement-planner"
const timestamp = "2026-11-10T00:00:00.000Z"
const createdAt = "2026-10-10T00:00:00.000Z"
function plan(variant: PlanVariant = "task"): Plan {
  return planSchema.parse({
    kind: "plan",
    variant,
    id: crypto.randomUUID(),
    ownerId: userId,
    title: "Common plan",
    description: "",
    status: "in_progress",
    checklist: [],
    recurrence: null,
    completedAt: null,
    schedule: {
      mode: "all_day",
      startDate: "2026-10-10",
      endDateExclusive: "2026-10-13",
    },
    revision: 1,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  })
}
function input(item = plan()) {
  return {
    userId,
    timestamp,
    items: [item],
    tags: [],
    views: [],
    placements: [] as TaskPlacement[],
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 0,
      command: {
        type: "task.move",
        itemId: item.id,
        occurrenceId: null,
        scope: "day",
        date: "2026-10-12",
        tagId: null,
        beforeId: null,
        afterId: null,
      },
    } as SyncOperation,
  }
}

for (const variant of planVariantSchema.options) {
  test(`${variant} moves on every included day only with common-plan support`, () => {
    const value = input(plan(variant))
    const before = JSON.stringify(value)
    expect(planRemoteTaskPlacementOperation(value)).toEqual({
      status: "unsupported",
    })
    const result = planRemoteTaskPlacementOperation(value, true)
    expect(result.status).toBe("changes")
    if (result.status !== "changes")
      throw new Error("Expected placement effects")
    expect(result.effects[0]).toMatchObject({
      store: "taskPlacements",
      record: {
        occurrenceId: value.items[0].id,
        scope: "day",
        date: "2026-10-12",
        revision: 1,
      },
    })
    expect(JSON.stringify(value)).toBe(before)
    if (value.operation.command.type !== "task.move")
      throw new Error("Expected move")
    value.operation.command.date = "2026-10-13"
    expect(planRemoteTaskPlacementOperation(value, true)).toEqual({
      status: "invalid_command",
    })
  })
}

test("common overdue movement follows the declared civil date and canonical anchor", () => {
  const value = input(plan("appointment"))
  if (value.operation.command.type !== "task.move")
    throw new Error("Expected move")
  value.operation.command.scope = "overdue"
  value.operation.command.date = "2026-10-13"
  const result = planRemoteTaskPlacementOperation(value, true)
  if (result.status !== "changes") throw new Error("Expected overdue effects")
  expect(result.effects[0]).toMatchObject({
    record: { date: overduePlacementDate },
  })
  const earlier = planRemoteTaskPlacementOperation(
    { ...value, timestamp: createdAt },
    true
  )
  if (earlier.status !== "changes")
    throw new Error("Expected delayed upload effects")
  expect(earlier.effects).toHaveLength(result.effects.length)
  for (const effect of earlier.effects)
    expect(effect.record).toMatchObject({ createdAt, updatedAt: createdAt })
  expect(earlier.effects[0]).toMatchObject({
    record: { date: overduePlacementDate },
  })
  value.operation.command.date = "2026-10-12"
  expect(planRemoteTaskPlacementOperation(value, true)).toEqual({
    status: "invalid_command",
  })
  value.operation.command.date = "2026-10-13"
  value.items[0] = {
    ...value.items[0],
    status: "completed",
    completedAt: createdAt,
  }
  expect(planRemoteTaskPlacementOperation(value, true)).toEqual({
    status: "invalid_command",
  })
})

test("default chronological and variant order gives stable ranks before an explicit move", () => {
  const peers = planVariantSchema.options.map((variant) => plan(variant))
  const target = peers[3]
  const value = input(target)
  value.items = [target, peers[2], peers[1], peers[0]]
  if (value.operation.command.type !== "task.move")
    throw new Error("Expected move")
  value.operation.command.beforeId = peers[1].id
  value.operation.command.afterId = peers[0].id
  const result = planRemoteTaskPlacementOperation(value, true)
  if (result.status !== "changes") throw new Error("Expected movement effects")
  const positions = result.effects
    .filter((effect) => effect.store === "taskPlacements")
    .map((effect) => effect.record)
    .toSorted((left, right) => left.position - right.position)
  expect(positions.map((record) => record.occurrenceId)).toEqual([
    peers[0].id,
    target.id,
    peers[1].id,
    peers[2].id,
  ])
})

test("wrong peers, stale primary CAS, occurrences and recurring plans are rejected", () => {
  const value = input()
  if (value.operation.command.type !== "task.move")
    throw new Error("Expected move")
  value.operation.command.beforeId = crypto.randomUUID()
  expect(planRemoteTaskPlacementOperation(value, true)).toEqual({
    status: "invalid_command",
  })
  value.operation.command.beforeId = null
  const current: TaskPlacement = {
    userId,
    occurrenceId: value.items[0].id,
    scope: "day",
    date: "2026-10-12",
    tagId: null,
    position: 0,
    revision: 1,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  }
  value.placements = [current]
  expect(planRemoteTaskPlacementOperation(value, true)).toEqual({
    status: "conflict",
    current,
  })
  value.placements = []
  value.operation.command.occurrenceId = `${value.items[0].id}:2026-10-12`
  expect(planRemoteTaskPlacementOperation(value, true)).toEqual({
    status: "unsupported",
  })
  value.operation.command.occurrenceId = null
  value.items[0] = {
    ...value.items[0],
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-10",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
  }
  expect(planRemoteTaskPlacementOperation(value, true)).toEqual({
    status: "unsupported",
  })
})
