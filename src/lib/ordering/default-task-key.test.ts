import { describe, expect, test } from "bun:test"
import { defaultTaskOrderKey } from "@/lib/ordering/default-task-key"
import { legacyRankOrderKey } from "@/lib/ordering/legacy-rank-key"
import {
  compareDefaultTaskOrder,
  type OrderableTask,
  orderPlacedTasks,
} from "@/lib/ordering/task-order"
import type { TaskPlacement } from "@/types/preferences"

const createdAt = "2026-10-07T12:00:00.000Z"
function compareKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
const tasks = ["0001-01-01", "2026-10-07", "9999-12-31"].flatMap(
  (scheduledDate) =>
    ["0001-01-01T00:00:00.000Z", createdAt, "9999-12-31T23:59:59.999Z"].flatMap(
      (createdAt) =>
        ["a", "a:0001-01-01", "a:9999-12-31", "A", "b"].map((id) => ({
          id,
          scheduledDate,
          createdAt,
        }))
    )
)

describe("implicit task order keys", () => {
  test("preserves the default comparator at date boundaries and identity ties", () => {
    for (const left of tasks)
      for (const right of tasks)
        expect(
          compareKeys(defaultTaskOrderKey(left), defaultTaskOrderKey(right))
        ).toBe(Math.sign(compareDefaultTaskOrder(left, right)))
  })

  test("reflects effective rescheduling without changing the original identity", () => {
    const original = {
      id: "series:0001-01-01",
      scheduledDate: "0001-01-01",
      createdAt,
    }
    const snapshot = JSON.stringify(original)
    const moved = { ...original, scheduledDate: "9999-12-31" }
    expect(defaultTaskOrderKey(moved) > defaultTaskOrderKey(original)).toBe(
      true
    )
    expect(defaultTaskOrderKey(moved).endsWith(`:${original.id}`)).toBe(true)
    expect(defaultTaskOrderKey(moved)).toBe(defaultTaskOrderKey({ ...moved }))
    expect(JSON.stringify(original)).toBe(snapshot)
  })

  test("candidate prefixes preserve mixed placed and implicit ordering", () => {
    const records = tasks.map((task, index) => ({
      ...task,
      id: `task-${index}`,
    }))
    const placements: TaskPlacement[] = records.flatMap((task, index) =>
      index % 3 === 0
        ? [
            {
              userId: "test-user",
              occurrenceId: task.id,
              scope: "overdue" as const,
              date: "0001-01-01",
              tagId: null,
              position: index % 2 === 0 ? -0 : -index / 3,
              revision: 1,
              createdAt,
              updatedAt: createdAt,
              deletedAt: null,
            },
          ]
        : []
    )
    const ranks = new Map(
      placements.map((placement) => [
        placement.occurrenceId,
        placement.position,
      ])
    )
    const key = (task: OrderableTask) => {
      const position = ranks.get(task.id)
      return position === undefined
        ? `1:${defaultTaskOrderKey(task)}`
        : `0:${legacyRankOrderKey({ id: task.id, position })}`
    }
    expect(
      records.toSorted((left, right) => compareKeys(key(left), key(right)))
    ).toEqual(orderPlacedTasks(records, placements, null))
  })

  test("rejects invalid dates, timestamps and identities", () => {
    const valid = { id: "task", scheduledDate: "2026-10-07", createdAt }
    for (const patch of [
      { scheduledDate: "0000-01-01" },
      { scheduledDate: "2026-02-30" },
      { createdAt: "2026-10-07T12:00:00+02:00" },
      { createdAt: "invalid" },
      { id: "task/other" },
      { id: "" },
    ])
      expect(() => defaultTaskOrderKey({ ...valid, ...patch })).toThrow()
  })
})
