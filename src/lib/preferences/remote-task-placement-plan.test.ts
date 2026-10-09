import { expect, test } from "bun:test"
import { planRemoteTaskPlacementOperation } from "@/lib/preferences/remote-task-placement-plan"
import { taskSchema } from "@/schemas/calendar-item"
import { overduePlacementDate } from "@/schemas/ordering"
import { maximumRemoteTaskCatalog } from "@/schemas/remote-task-placement-planning"
import type { Task } from "@/types/calendar-item"
import type { ItemView, Tag, TaskPlacement } from "@/types/preferences"

const userId = "remote-task-placement-planner"
const itemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const peerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const tagId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const createdAt = "2026-10-07T00:00:00.000Z"
const timestamp = "2026-11-08T00:00:00.000Z"
const metadata = {
  revision: 1,
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
}
const item = taskSchema.parse({
  ...metadata,
  id: itemId,
  ownerId: userId,
  kind: "task",
  title: "Task",
  description: "Untouched content",
  scheduledDate: "2026-10-08",
  status: "in_progress",
  completedAt: null,
  recurrence: null,
  checklist: [],
})
const tag: Tag = {
  ...metadata,
  userId,
  id: tagId,
  name: "Work",
  normalizedName: "work",
  color: "#ffffff",
  position: 0,
}
function view(id = itemId): ItemView {
  return { ...metadata, userId, itemId: id, primaryTagId: tagId }
}
function placement(id = itemId, position = 0): TaskPlacement {
  return {
    ...metadata,
    userId,
    occurrenceId: id,
    scope: "day",
    date: "2026-10-08",
    tagId,
    position,
  }
}
function input() {
  return {
    userId,
    timestamp,
    items: [item] as Task[],
    tags: [tag],
    views: [] as ItemView[],
    placements: [] as TaskPlacement[],
    operation: {
      protocolVersion: 1 as const,
      operationId: crypto.randomUUID(),
      baseRevision: 0,
      command: {
        type: "task.move" as const,
        itemId,
        occurrenceId: null as string | null,
        scope: "day" as "day" | "overdue",
        date: "2026-10-08",
        tagId: tagId as string | null,
        beforeId: null as string | null,
        afterId: null as string | null,
      },
    },
  }
}

test("historical movement creates canonical placement and category with untouched intention and content", () => {
  const value = input()
  const before = JSON.stringify(value)
  const planned = planRemoteTaskPlacementOperation(value)
  expect(planned.status).toBe("changes")
  if (planned.status !== "changes") throw new Error("Expected movement effects")
  expect(planned.effects).toEqual([
    {
      store: "taskPlacements",
      record: {
        ...placement(),
        position: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    {
      store: "itemViews",
      record: { ...view(), createdAt: timestamp, updatedAt: timestamp },
    },
  ])
  expect(JSON.stringify(value)).toBe(before)
  planned.effects[0].record.updatedAt = createdAt
  expect(value.timestamp).toBe(timestamp)
})

test("placement is the primary CAS identity and each changed document advances its own revision", () => {
  const value = input()
  value.placements = [placement()]
  value.views = [{ ...view(), primaryTagId: null, revision: 5 }]
  expect(planRemoteTaskPlacementOperation(value)).toEqual({
    status: "conflict",
    current: placement(),
  })
  value.operation.baseRevision = 1
  const planned = planRemoteTaskPlacementOperation(value)
  if (planned.status !== "changes") throw new Error("Expected movement effects")
  expect(planned.effects.map((effect) => effect.record.revision)).toEqual([
    2, 6,
  ])
  expect(planned.effects.map((effect) => effect.record.createdAt)).toEqual([
    createdAt,
    createdAt,
  ])
  value.views = [view()]
  const rankOnly = planRemoteTaskPlacementOperation(value)
  if (rankOnly.status !== "changes") throw new Error("Expected rank effects")
  expect(rankOnly.effects).toHaveLength(1)
  value.placements = []
  expect(planRemoteTaskPlacementOperation(value)).toEqual({
    status: "unavailable",
  })
  value.placements = [{ ...placement(), deletedAt: createdAt }]
  expect(planRemoteTaskPlacementOperation(value)).toEqual({
    status: "conflict",
    current: value.placements[0],
  })
})

test("overdue uses declared civil day and permanent anchor even when upload happens a month later", () => {
  const value = input()
  value.operation.command.scope = "overdue"
  value.operation.command.date = "2026-10-09"
  const planned = planRemoteTaskPlacementOperation(value)
  if (
    planned.status !== "changes" ||
    planned.effects[0].store !== "taskPlacements"
  )
    throw new Error("Expected overdue effects")
  expect(planned.effects[0].record.date).toBe(overduePlacementDate)
  expect(planned.effects[0].record.updatedAt).toBe(timestamp)
  expect(value.operation.command.date).toBe("2026-10-09")
  expect(
    planRemoteTaskPlacementOperation({
      ...value,
      timestamp: "2026-10-08T23:59:59.000Z",
    }).status
  ).toBe("changes")
  value.operation.command.date = "2026-10-08"
  expect(planRemoteTaskPlacementOperation(value)).toEqual({
    status: "invalid_command",
  })
  value.operation.command.date = "2026-10-09"
  value.items = [{ ...item, status: "completed", completedAt: createdAt }]
  expect(planRemoteTaskPlacementOperation(value)).toEqual({
    status: "invalid_command",
  })
  value.items = [{ ...item, scheduledDate: "2026-10-10" }]
  expect(planRemoteTaskPlacementOperation(value)).toEqual({
    status: "invalid_command",
  })
})

test("current day membership, live categories, tombstones and explicit unsupported series are preserved", () => {
  const value = input()
  expect(planRemoteTaskPlacementOperation({ ...value, items: [] })).toEqual({
    status: "unavailable",
  })
  expect(
    planRemoteTaskPlacementOperation({
      ...value,
      items: [{ ...item, deletedAt: createdAt }],
    })
  ).toEqual({ status: "unavailable" })
  expect(
    planRemoteTaskPlacementOperation({
      ...value,
      items: [{ ...item, scheduledDate: "2026-10-09" }],
    })
  ).toEqual({ status: "invalid_command" })
  for (const tags of [[], [{ ...tag, deletedAt: createdAt }]])
    expect(planRemoteTaskPlacementOperation({ ...value, tags })).toEqual({
      status: "invalid_command",
    })
  expect(
    planRemoteTaskPlacementOperation({
      ...value,
      views: [{ ...view(), deletedAt: createdAt }],
    })
  ).toEqual({ status: "invalid_command" })
  expect(
    planRemoteTaskPlacementOperation({
      ...value,
      items: [
        {
          ...item,
          recurrence: {
            frequency: "daily",
            interval: 1,
            anchorDate: item.scheduledDate,
            timeZone: "Europe/Madrid",
            end: { type: "never" },
          },
        },
      ],
    })
  ).toEqual({ status: "unsupported" })
  value.operation.command.occurrenceId = `${itemId}:2026-10-08`
  expect(planRemoteTaskPlacementOperation(value)).toEqual({
    status: "unsupported",
  })
})

test("implicit neighbors, category transitions and compacted peers share full validated effects", () => {
  const value = input()
  value.items.push({ ...item, id: peerId })
  value.views = [view(), view(peerId)]
  value.operation.command.afterId = peerId
  let planned = planRemoteTaskPlacementOperation(value)
  if (planned.status !== "changes") throw new Error("Expected implicit effects")
  expect(planned.effects.map((effect) => effect.store)).toEqual([
    "taskPlacements",
    "taskPlacements",
  ])
  expect(
    planned.effects.find(
      (effect) =>
        effect.store === "taskPlacements" &&
        effect.record.occurrenceId === itemId
    )?.record
  ).toMatchObject({ position: 3072, revision: 1 })
  value.placements = [placement(peerId, 1e12)]
  planned = planRemoteTaskPlacementOperation(value)
  if (planned.status !== "changes")
    throw new Error("Expected compacted effects")
  expect(planned.effects.map((effect) => effect.record.revision)).toEqual([
    2, 1,
  ])
  expect(
    planned.effects.map((effect) =>
      effect.store === "taskPlacements" ? effect.record.position : null
    )
  ).toEqual([-1024, 0])
  value.operation.command.beforeId = crypto.randomUUID()
  expect(planRemoteTaskPlacementOperation(value)).toEqual({
    status: "invalid_command",
  })
})

test("whole catalogs reject foreign, duplicate, corrupt and unbounded input without planning partial effects", () => {
  const value = input()
  for (const changed of [
    { items: [{ ...item, ownerId: "foreign" }] },
    { items: [{ ...item, revision: 0 }] },
    { items: [item, item] },
    { tags: [{ ...tag, userId: "foreign" }] },
    { tags: [tag, { ...tag, id: peerId }] },
    { views: [{ ...view(), userId: "foreign" }] },
    { views: [view(), view()] },
    { placements: [{ ...placement(), userId: "foreign" }] },
    { placements: [placement(), placement()] },
    { placements: [{ ...placement(), scope: "overdue", date: "2026-10-08" }] },
    {
      items: Array.from(
        { length: maximumRemoteTaskCatalog + 1 },
        (_, index) => ({
          ...item,
          id:
            index.toString(16).padStart(8, "0") +
            "-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        })
      ),
    },
  ])
    expect(() =>
      planRemoteTaskPlacementOperation({ ...value, ...changed })
    ).toThrow()
  const overflow = { ...placement(), revision: Number.MAX_SAFE_INTEGER }
  expect(
    planRemoteTaskPlacementOperation({
      ...value,
      placements: [overflow],
      operation: { ...value.operation, baseRevision: Number.MAX_SAFE_INTEGER },
    })
  ).toEqual({ status: "invalid_command" })
})

test("large implicit groups cannot exceed journal byte bounds or restore a peer tombstone", () => {
  const value = input()
  value.items.push({ ...item, id: peerId })
  value.views = [view(), view(peerId)]
  value.operation.command.afterId = peerId
  value.placements = [{ ...placement(peerId), deletedAt: createdAt }]
  expect(planRemoteTaskPlacementOperation(value)).toEqual({
    status: "invalid_command",
  })
  const large = input()
  large.operation.command.tagId = null
  large.items.push(
    ...Array.from({ length: 4999 }, (_, index) => ({
      ...item,
      id: `${index.toString(16).padStart(8, "0")}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
    }))
  )
  large.operation.command.afterId = large.items.at(-1)?.id ?? null
  const before = JSON.stringify(large)
  expect(planRemoteTaskPlacementOperation(large)).toEqual({
    status: "invalid_command",
  })
  expect(JSON.stringify(large)).toBe(before)
})
