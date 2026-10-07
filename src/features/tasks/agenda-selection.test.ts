import { describe, expect, test } from "bun:test"
import {
  groupAgendaTasks,
  selectAgendaTasks,
} from "@/features/tasks/agenda-selection"
import { todayInTimeZone } from "@/lib/calendar/civil-date"
import { taskSchema } from "@/schemas/calendar-item"
import { tagSchema } from "@/schemas/preferences"
import type { Task } from "@/types/calendar-item"

const metadata = {
  revision: 0,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  deletedAt: null,
}
function task(date: string, status: Task["status"] = "not_started") {
  return taskSchema.parse({
    ...metadata,
    id: crypto.randomUUID(),
    ownerId: "test-owner",
    kind: "task",
    title: "Test task",
    description: "",
    scheduledDate: date,
    status,
    checklist: [],
    recurrence: null,
    completedAt: status === "completed" ? metadata.updatedAt : null,
  })
}
function tag(name: string, position: number) {
  return tagSchema.parse({
    ...metadata,
    id: crypto.randomUUID(),
    userId: "test-owner",
    name,
    normalizedName: name.toLowerCase(),
    color: "#059669",
    position,
  })
}

describe("local task agenda", () => {
  test("overdue preserves progress and original date while completed items remain in their day", () => {
    const pending = task("2026-10-06", "in_progress")
    const done = task("2026-10-06", "completed")
    const current = task("2026-10-07")
    const records = [pending, done, current]
    expect(
      selectAgendaTasks(records, { kind: "overdue", date: "2026-10-07" })
    ).toEqual([pending])
    expect(
      selectAgendaTasks(records, { kind: "day", date: "2026-10-06" })
    ).toEqual([pending, done])
    expect(
      selectAgendaTasks(records, { kind: "upcoming", date: "2026-10-07" })
    ).toEqual([current])
    expect(pending.status).toBe("in_progress")
    expect(pending.scheduledDate).toBe("2026-10-06")
  })
  test("changing the account day updates classification without mutating records", () => {
    const current = task("2026-10-06")
    const before = JSON.stringify(current)
    const day = (instant: string) =>
      todayInTimeZone("Europe/Madrid", () => new Date(instant))
    expect(
      selectAgendaTasks([current], {
        kind: "overdue",
        date: day("2026-10-06T21:59:59.000Z"),
      })
    ).toEqual([])
    expect(
      selectAgendaTasks([current], {
        kind: "overdue",
        date: day("2026-10-06T22:00:00.000Z"),
      })
    ).toEqual([current])
    expect(JSON.stringify(current)).toBe(before)
  })
  test("groups each task once in personal category order and retains uncategorized records", () => {
    const later = tag("Later", 20)
    const first = tag("First", 1)
    const deleted = { ...tag("Deleted", 0), deletedAt: metadata.updatedAt }
    const records = Array.from({ length: 5 }, () => task("2026-10-07"))
    const groups = groupAgendaTasks(records, {
      tags: [later, deleted, first],
      views: {
        [records[0].id]: later.id,
        [records[1].id]: first.id,
        [records[2].id]: deleted.id,
        [records[3].id]: crypto.randomUUID(),
        [records[4].id]: null,
      },
    })
    expect(groups.map((group) => group.title)).toEqual([
      "First",
      "Later",
      "Sin categoría",
    ])
    expect(groups[2].tasks).toHaveLength(3)
    expect(
      new Set(groups.flatMap((group) => group.tasks.map((item) => item.id)))
        .size
    ).toBe(records.length)
    expect(groupAgendaTasks(records)[0].title).toBe("Tareas")
    expect(groupAgendaTasks([], { tags: [], views: {} })).toEqual([])
  })
})
