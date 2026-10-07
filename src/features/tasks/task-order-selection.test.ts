import { describe, expect, test } from "bun:test"
import {
  orderAgendaGroupTasks,
  taskOrderContext,
  taskOrderPeers,
} from "@/features/tasks/task-order-selection"
import { taskSchema } from "@/schemas/calendar-item"
import { overduePlacementDate } from "@/schemas/ordering"
import { taskPlacementSchema } from "@/schemas/preferences"

const userId = "task-order-selection-owner"
const metadata = {
  revision: 0,
  createdAt: "2026-10-07T06:00:00.000Z",
  updatedAt: "2026-10-07T06:00:00.000Z",
  deletedAt: null,
}
function task(date: string) {
  return taskSchema.parse({
    ...metadata,
    id: crypto.randomUUID(),
    ownerId: userId,
    kind: "task",
    title: "Ordered task",
    description: "",
    scheduledDate: date,
    status: "in_progress",
    completedAt: null,
    checklist: [],
    recurrence: null,
  })
}
function placement(
  itemId: string,
  scope: "day" | "overdue",
  date: string,
  position: number,
  tagId: string | null = null
) {
  return taskPlacementSchema.parse({
    ...metadata,
    userId,
    occurrenceId: itemId,
    scope,
    date,
    position,
    tagId,
  })
}

describe("agenda ordering views", () => {
  test("upcoming orders each day separately and its controls never move a date", () => {
    const today = task("2026-10-07"),
      other = task("2026-10-07"),
      future = task("2026-10-08")
    const items = [today, other, future]
    const original = JSON.stringify(items)
    const selection = { kind: "upcoming" as const, date: "2026-10-07" }
    const placements = [
      placement(today.id, "day", today.scheduledDate, 100),
      placement(other.id, "day", other.scheduledDate, 0),
      placement(future.id, "day", future.scheduledDate, -1000),
    ]
    expect(
      orderAgendaGroupTasks(items, placements, selection, null).map(
        (item) => item.id
      )
    ).toEqual([other.id, today.id, future.id])
    expect(
      taskOrderPeers(items, selection, today).map((item) => item.id)
    ).toEqual([today.id, other.id])
    expect(taskOrderContext(selection, future)).toEqual({
      scope: "day",
      date: future.scheduledDate,
    })
    expect(JSON.stringify(items)).toBe(original)
  })
  test("overdue uses canonical global ranks and ignores other scopes or categories", () => {
    const yesterday = task("2026-10-06"),
      older = task("2026-10-05")
    const selection = { kind: "overdue" as const, date: "2026-10-07" }
    const placements = [
      placement(yesterday.id, "overdue", overduePlacementDate, 0),
      placement(older.id, "overdue", overduePlacementDate, 100),
      placement(older.id, "day", older.scheduledDate, -1000),
    ]
    expect(
      orderAgendaGroupTasks(
        [older, yesterday],
        placements,
        selection,
        null
      ).map((item) => item.id)
    ).toEqual([yesterday.id, older.id])
    expect(
      taskOrderPeers([older, yesterday], selection, yesterday).length
    ).toBe(2)
    expect(taskOrderContext(selection, yesterday)).toEqual({
      scope: "overdue",
      date: selection.date,
    })
    const mismatched = placements.map((record) =>
      record.occurrenceId === older.id
        ? { ...record, tagId: crypto.randomUUID() }
        : record
    )
    expect(
      orderAgendaGroupTasks(
        [older, yesterday],
        mismatched,
        selection,
        null
      ).map((item) => item.id)
    ).toEqual([yesterday.id, older.id])
  })
})
