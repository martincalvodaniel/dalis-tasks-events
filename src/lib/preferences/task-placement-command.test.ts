import { describe, expect, test } from "bun:test"
import { planTaskPlacements as adapterPlan } from "@/lib/local-db/task-placement-mutation"
import type { OrderableTask } from "@/lib/ordering/task-order"
import {
  planTaskPlacements,
  type TaskMoveCommand,
} from "@/lib/preferences/task-placement-command"
import { overduePlacementDate } from "@/schemas/ordering"
import { taskPlacementSchema } from "@/schemas/preferences"
import type { TaskPlacement } from "@/types/preferences"

const userId = "placement-command-owner"
const date = "2026-10-09"
const timestamp = "2026-10-09T10:00:00.000Z"
const createdAt = "2026-10-01T10:00:00.000Z"
const ids = [
  "10000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
  "30000000-0000-4000-8000-000000000003",
]
const tagId = "40000000-0000-4000-8000-000000000004"
const ordered: OrderableTask[] = ids.map((id) => ({
  id,
  scheduledDate: date,
  createdAt,
}))
const command: TaskMoveCommand = {
  type: "task.move",
  itemId: ids[2],
  occurrenceId: null,
  scope: "day",
  date,
  tagId: null,
  beforeId: ids[1],
  afterId: ids[0],
}

function placement(
  occurrenceId: string,
  position: number,
  overrides: Partial<TaskPlacement> = {}
): TaskPlacement {
  return taskPlacementSchema.parse({
    userId,
    occurrenceId,
    position,
    scope: "day",
    date,
    tagId: null,
    revision: 0,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    ...overrides,
  })
}

describe("pure task placement command", () => {
  test("materializes implicit ranks while preserving negative and fractional neighbors", () => {
    const scoped = [placement(ids[0], -2.5), placement(ids[1], -1.25)]
    const original = structuredClone({ ordered, scoped, command })
    const result = planTaskPlacements(
      ordered,
      scoped,
      ids[2],
      command,
      userId,
      timestamp
    )
    expect(result).toEqual([
      placement(ids[2], -1.875, { createdAt: timestamp, updatedAt: timestamp }),
    ])
    expect({ ordered, scoped, command }).toEqual(original)
    const implicit = planTaskPlacements(
      ordered,
      [],
      ids[2],
      command,
      userId,
      timestamp
    )
    expect(implicit.map((record) => record.position)).toEqual([
      1024, 2048, 1536,
    ])
    expect(implicit.every((record) => record.revision === 0)).toBe(true)
    expect(adapterPlan).toBe(planTaskPlacements)
  })

  test("compacts the complete destination with independent revisions and creation times", () => {
    const scoped = [
      placement(ids[0], 1, { revision: 3 }),
      placement(ids[1], 1 + Number.EPSILON, {
        revision: 19,
        createdAt: "2026-10-02T10:00:00.000Z",
      }),
      placement(ids[2], 20, { revision: 7 }),
    ]
    const original = structuredClone(scoped)
    const result = planTaskPlacements(
      ordered,
      scoped,
      ids[2],
      command,
      userId,
      timestamp
    )
    expect(result.map((record) => record.position)).toEqual([-1024, 1024, 0])
    expect(result.map((record) => record.revision)).toEqual([3, 19, 7])
    expect(result.map((record) => record.createdAt)).toEqual(
      scoped.map((record) => record.createdAt)
    )
    expect(result.every((record) => record.updatedAt === timestamp)).toBe(true)
    result[0].position = 999
    expect(scoped).toEqual(original)
  })

  test("compacts implicit positions that would exceed the stored rank range", () => {
    const scoped = [placement(ids[0], 1e12, { revision: 11 })]
    const result = planTaskPlacements(
      ordered,
      scoped,
      ids[2],
      command,
      userId,
      timestamp
    )
    expect(result.map((record) => record.position)).toEqual([-1024, 0, -512])
    expect(result.map((record) => record.revision)).toEqual([11, 0, 0])
    expect(scoped[0].position).toBe(1e12)
  })

  test("changes category for an occurrence without replacing its personal identity or metadata", () => {
    const occurrenceId = `${ids[2]}:${date}`
    const tasks = [...ordered.slice(0, 2), { ...ordered[2], id: occurrenceId }]
    const scoped = [
      placement(ids[0], -10, { tagId }),
      placement(ids[1], 10, { tagId }),
      placement(occurrenceId, 900, { revision: 23 }),
    ]
    const input: TaskMoveCommand = { ...command, occurrenceId, tagId }
    const original = structuredClone({ tasks, scoped, input })
    const result = planTaskPlacements(
      tasks,
      scoped,
      occurrenceId,
      input,
      userId,
      timestamp
    )
    expect(result).toEqual([
      placement(occurrenceId, 0, { tagId, revision: 23, updatedAt: timestamp }),
    ])
    expect({ tasks, scoped, input }).toEqual(original)
    result[0].tagId = null
    expect(scoped[2].tagId).toBeNull()
    expect(input.tagId).toBe(tagId)
  })

  test("anchors overdue records to the sentinel while preserving the command civil day", () => {
    const input: TaskMoveCommand = { ...command, scope: "overdue" }
    Object.freeze(input)
    const result = planTaskPlacements(
      ordered,
      [],
      ids[2],
      input,
      userId,
      timestamp
    )
    expect(result.every((record) => record.date === overduePlacementDate)).toBe(
      true
    )
    expect(result.every((record) => record.scope === "overdue")).toBe(true)
    expect(input.date).toBe(date)
  })

  test("rejects tombstones, missing targets and non-adjacent neighbors without input writes", () => {
    for (const tombstoneId of [ids[0], ids[2]]) {
      const scoped = [placement(tombstoneId, 10, { deletedAt: timestamp })]
      const original = structuredClone(scoped)
      expect(() =>
        planTaskPlacements(ordered, scoped, ids[2], command, userId, timestamp)
      ).toThrow("Deleted task placement cannot be restored")
      expect(scoped).toEqual(original)
    }
    for (const input of [
      { ...command, beforeId: null, afterId: null },
      { ...command, beforeId: ids[1], afterId: null },
      { ...command, beforeId: ids[0], afterId: ids[1] },
      { ...command, beforeId: ids[2] },
      { ...command, beforeId: "unavailable" },
    ]) {
      const original = structuredClone(input)
      expect(() =>
        planTaskPlacements(ordered, [], ids[2], input, userId, timestamp)
      ).toThrow()
      expect(input).toEqual(original)
    }
    expect(() =>
      planTaskPlacements(ordered, [], "unavailable", command, userId, timestamp)
    ).toThrow("Moved record is unavailable")
  })
})
