import { describe, expect, test } from "bun:test"
import {
  planLocalTaskMove,
  type TaskMoveCommand,
  type TaskMoveSnapshot,
} from "@/lib/local-db/task-move-mutation"
import { orderPlacedTasks } from "@/lib/ordering/task-order"
import { taskSchema } from "@/schemas/calendar-item"
import { outboxEntrySchema } from "@/schemas/local-sync"
import {
  overduePlacementDate,
  taskPlacementEntityKey,
  taskPlacementEntityKeySchema,
} from "@/schemas/ordering"
import {
  itemViewSchema,
  tagSchema,
  taskPlacementSchema,
  userSettingsSchema,
} from "@/schemas/preferences"
import { syncCommandSchema } from "@/schemas/sync"

const userId = "task-ordering-owner"
const now = "2026-10-06T22:30:00.000Z"
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
const items = ids.map((id) =>
  taskSchema.parse({
    ...metadata,
    id,
    ownerId: userId,
    kind: "task",
    title: "Test task",
    description: "",
    scheduledDate: "2026-10-06",
    status: "in_progress",
    completedAt: null,
    checklist: [],
    recurrence: null,
  })
)
const tag = tagSchema.parse({
  ...metadata,
  id: tagId,
  userId,
  name: "Work",
  normalizedName: "work",
  color: "#059669",
  position: 0,
})
const snapshot: TaskMoveSnapshot = {
  items,
  tags: [tag],
  views: [],
  placements: [],
  settings: userSettingsSchema.parse({
    ...metadata,
    userId,
    timeZone: "Europe/Madrid",
    weekStartsOn: 1,
    locale: "es-ES",
  }),
}
const command: TaskMoveCommand = {
  type: "task.move",
  itemId: ids[2],
  occurrenceId: null,
  scope: "day",
  date: "2026-10-06",
  tagId: null,
  beforeId: ids[1],
  afterId: ids[0],
}
function placement(
  occurrenceId: string,
  position: number,
  scope: "day" | "overdue" = "day",
  date = "2026-10-06"
) {
  return taskPlacementSchema.parse({
    ...metadata,
    userId,
    occurrenceId,
    position,
    scope,
    date,
    tagId: null,
  })
}

describe("atomic task movement planning", () => {
  test("materializes implicit ranks and changes category without touching task content", () => {
    const views = items.slice(0, 2).map((item) =>
      itemViewSchema.parse({
        ...metadata,
        userId,
        itemId: item.id,
        primaryTagId: tagId,
      })
    )
    const input = { ...snapshot, views }
    const original = JSON.stringify(input)
    const planned = planLocalTaskMove(input, { ...command, tagId }, userId, now)
    expect(planned.view?.primaryTagId).toBe(tagId)
    expect(planned.placements.length).toBe(3)
    expect(
      orderPlacedTasks(items, planned.placements, tagId).map((item) => item.id)
    ).toEqual([ids[0], ids[2], ids[1]])
    expect(JSON.stringify(input)).toBe(original)
    expect(planned.current).toBeNull()
    expect(
      planned.placements.every(
        (record) => record.date === command.date && record.tagId === tagId
      )
    ).toBe(true)
  })
  test("compacts exhausted intervals while preserving personal revisions and other scopes", () => {
    const placements = [
      placement(ids[0], 1),
      placement(ids[1], 1 + Number.EPSILON),
      { ...placement(ids[2], 20), revision: 7 },
      placement(ids[0], 99, "overdue", overduePlacementDate),
    ]
    const original = JSON.stringify(placements)
    const planned = planLocalTaskMove(
      { ...snapshot, placements },
      command,
      userId,
      now
    )
    expect(planned.current?.revision).toBe(7)
    expect(
      planned.placements.find((record) => record.occurrenceId === ids[2])
        ?.revision
    ).toBe(7)
    expect(planned.placements.every((record) => record.scope === "day")).toBe(
      true
    )
    expect(
      orderPlacedTasks(items, planned.placements, null).map((item) => item.id)
    ).toEqual([ids[0], ids[2], ids[1]])
    expect(JSON.stringify(placements)).toBe(original)
  })
  test("overdue uses the account day and a stable placement anchor across midnight", () => {
    const overdue = {
      ...command,
      scope: "overdue" as const,
      date: "2026-10-07",
    }
    const planned = planLocalTaskMove(snapshot, overdue, userId, now)
    expect(
      planned.placements.every((record) => record.date === overduePlacementDate)
    ).toBe(true)
    const nextDay = planLocalTaskMove(
      { ...snapshot, placements: planned.placements },
      { ...overdue, date: "2026-10-08", beforeId: ids[0], afterId: null },
      userId,
      "2026-10-07T22:30:00.000Z"
    )
    expect(nextDay.current?.date).toBe(overduePlacementDate)
    expect(() =>
      planLocalTaskMove(
        snapshot,
        { ...overdue, date: "2026-10-06" },
        userId,
        now
      )
    ).toThrow()
    expect(() =>
      planLocalTaskMove({ ...snapshot, settings: null }, overdue, userId, now)
    ).toThrow()
    expect(() =>
      planLocalTaskMove(
        {
          ...snapshot,
          items: items.map((item) => ({
            ...item,
            status: "completed" as const,
            completedAt: now,
          })),
        },
        overdue,
        userId,
        now
      )
    ).toThrow()
  })
  test("preserves legacy records and rejects unsupported, stale or foreign targets", () => {
    const legacy = placement(ids[0], 9, "overdue", "2026-10-05")
    const input = { ...snapshot, placements: [legacy] }
    const original = JSON.stringify(input)
    expect(() =>
      planLocalTaskMove(
        input,
        { ...command, scope: "overdue", date: "2026-10-07" },
        userId,
        now
      )
    ).toThrow("migration")
    expect(
      planLocalTaskMove(input, command, userId, now).placements.every(
        (record) => record.scope === "day"
      )
    ).toBe(true)
    expect(JSON.stringify(input)).toBe(original)
    for (const changed of [
      { ...command, occurrenceId: "legacy:occurrence" },
      { ...command, date: "2026-10-07" },
      { ...command, beforeId: null, afterId: null },
      { ...command, tagId: crypto.randomUUID() },
    ])
      expect(() => planLocalTaskMove(snapshot, changed, userId, now)).toThrow()
    expect(() =>
      planLocalTaskMove(
        {
          ...snapshot,
          items: items.map((item) => ({ ...item, ownerId: "other" })),
        },
        command,
        userId,
        now
      )
    ).toThrow()
    expect(() =>
      planLocalTaskMove(
        { ...snapshot, tags: [{ ...tag, userId: "other" }] },
        command,
        userId,
        now
      )
    ).toThrow()
  })
  test("validates personal keys and keeps earlier occurrence commands readable", () => {
    const entityKey = taskPlacementEntityKey(ids[2], "day", command.date)
    const entry = {
      userId,
      entityKey,
      sequence: 1,
      operation: {
        operationId: crypto.randomUUID(),
        protocolVersion: 1,
        baseRevision: 0,
        command,
      },
      dependencies: [],
      state: "pending",
      attempts: 0,
      createdAt: now,
      lease: null,
    }
    expect(outboxEntrySchema.safeParse(entry).success).toBe(true)
    expect(
      outboxEntrySchema.safeParse({ ...entry, entityKey: `item:${ids[2]}` })
        .success
    ).toBe(false)
    expect(
      outboxEntrySchema.safeParse({
        ...entry,
        entityKey: taskPlacementEntityKey(ids[1], "day", command.date),
      }).success
    ).toBe(false)
    expect(
      outboxEntrySchema.safeParse({
        ...entry,
        entityKey: `item:${ids[2]}`,
        operation: {
          ...entry.operation,
          command: { ...command, occurrenceId: "legacy:occurrence" },
        },
      }).success
    ).toBe(true)
    expect(
      taskPlacementEntityKeySchema.safeParse(
        taskPlacementEntityKey("series:slot", "overdue", "2026-10-07")
      ).success
    ).toBe(true)
    expect(
      taskPlacementEntityKeySchema.safeParse(
        'task-placement:["series:slot","overdue","2026-10-07"]'
      ).success
    ).toBe(false)
    for (const invalid of [
      { ...command, beforeId: ids[2] },
      { ...command, beforeId: "missing" },
      { ...command, afterId: ids[1] },
    ])
      expect(syncCommandSchema.safeParse(invalid).success).toBe(false)
  })
})
