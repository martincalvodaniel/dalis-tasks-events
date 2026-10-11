import { expect, test } from "bun:test"
import { planLocalPlanMove } from "@/lib/local-db/plan-move-mutation"
import { planLocalRecurringPlanMove } from "@/lib/local-db/recurring-plan-move"
import type {
  TaskMoveCommand,
  TaskMoveSnapshot,
} from "@/lib/local-db/task-move-mutation"
import { planSchema } from "@/schemas/plan-item"

const owner = "local-recurring-move-owner"
const now = "2026-10-11T10:00:00.000Z"
function fixture() {
  const parent = planSchema.parse({
    kind: "plan",
    id: crypto.randomUUID(),
    ownerId: owner,
    variant: "appointment",
    title: "Series",
    description: "",
    status: "not_started",
    checklist: [],
    completedAt: null,
    schedule: {
      mode: "all_day",
      startDate: "2026-10-10",
      endDateExclusive: "2026-10-11",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-10",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
    revision: 2,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  const command: TaskMoveCommand = {
    type: "task.move",
    itemId: parent.id,
    occurrenceId: `${parent.id}:2026-10-11`,
    date: "2026-10-11",
    scope: "day",
    tagId: null,
    beforeId: null,
    afterId: null,
  }
  const snapshot: TaskMoveSnapshot = {
    items: [parent],
    occurrences: [],
    views: [],
    tags: [],
    placements: [],
    settings: null,
  }
  return { snapshot, command }
}
test("local recurring movement preserves confirmed revisions and current common caller remains strict", () => {
  const { snapshot, command } = fixture()
  const original = JSON.stringify(snapshot)
  const first = planLocalRecurringPlanMove(snapshot, command, owner, now)
  expect(first.placements[0]).toMatchObject({
    revision: 0,
    occurrenceId: command.occurrenceId,
    position: 0,
  })
  expect(first.view?.revision).toBe(0)
  expect(first.current).toBeNull()
  snapshot.placements = [{ ...first.placements[0], revision: 3 }]
  expect(
    planLocalRecurringPlanMove(snapshot, command, owner, now).placements[0]
      .revision
  ).toBe(3)
  snapshot.placements = []
  expect(JSON.stringify(snapshot)).toBe(original)
  expect(() => planLocalPlanMove(snapshot, command, owner, now)).toThrow()
})
test("new overdue intention requires the current account day while its placement uses the permanent date", () => {
  const { snapshot, command } = fixture()
  command.scope = "overdue"
  command.occurrenceId = `${command.itemId}:2026-10-10`
  expect(() =>
    planLocalRecurringPlanMove(snapshot, command, owner, now)
  ).toThrow("current account day")
  snapshot.settings = {
    userId: owner,
    timeZone: "Europe/Madrid",
    weekStartsOn: 1,
    locale: "es-ES",
    revision: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  expect(
    planLocalRecurringPlanMove(snapshot, command, owner, now).placements[0].date
  ).toBe("0001-01-01")
  command.date = "2026-10-12"
  expect(() =>
    planLocalRecurringPlanMove(snapshot, command, owner, now)
  ).toThrow("current account day")
  snapshot.settings.userId = "foreign"
  expect(() =>
    planLocalRecurringPlanMove(snapshot, command, owner, now)
  ).toThrow("another account")
})
