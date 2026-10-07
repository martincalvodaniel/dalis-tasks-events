import { expect, test } from "bun:test"
import { applyLocalOccurrenceProgress } from "@/lib/local-db/occurrence-progress"
import { taskSchema } from "@/schemas/calendar-item"

const id = "8a7a7969-1d11-4f36-9ce3-c1b933e849c2"
const entryId = "2d464e90-7889-4e80-bcbc-9da82f29138b"
const now = "2026-10-07T10:00:00.000Z"
const later = "2026-10-08T10:00:00.000Z"
const task = taskSchema.parse({
  id,
  ownerId: "test-owner",
  title: "Test series",
  description: "",
  kind: "task",
  revision: 4,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
  scheduledDate: "2026-10-07",
  status: "completed",
  completedAt: now,
  checklist: [{ id: entryId, text: "Template step", completed: true }],
  recurrence: {
    frequency: "daily",
    anchorDate: "2026-10-07",
    timeZone: "Europe/Madrid",
    interval: 2,
    end: { type: "count", count: 2 },
  },
})
const status = {
  type: "task.set-status" as const,
  itemId: id,
  occurrenceId: `${id}:2026-10-07`,
  status: "in_progress" as const,
}

test("occurrence progress materializes only the chosen slot and preserves per-field state and timestamps", () => {
  const started = applyLocalOccurrenceProgress(
    task,
    null,
    status,
    task.ownerId,
    now
  )
  expect(started).toMatchObject({
    status: "in_progress",
    revision: 0,
    completedAt: null,
    createdAt: now,
    checklist: [{ completed: false }],
  })
  const checked = applyLocalOccurrenceProgress(
    task,
    started,
    {
      type: "task.set-checklist-entry",
      itemId: id,
      occurrenceId: status.occurrenceId,
      entryId,
      completed: true,
    },
    task.ownerId,
    later
  )
  expect(checked).toMatchObject({
    status: "in_progress",
    createdAt: now,
    updatedAt: later,
    checklist: [{ completed: true }],
  })
  const completed = applyLocalOccurrenceProgress(
    task,
    checked,
    { ...status, status: "completed" },
    task.ownerId,
    later
  )
  expect(completed.completedAt).toBe(later)
  expect(
    applyLocalOccurrenceProgress(
      task,
      completed,
      { ...status, status: "completed" },
      task.ownerId,
      now
    ).completedAt
  ).toBe(later)
  expect(
    applyLocalOccurrenceProgress(
      task,
      completed,
      { ...status, status: "not_started" },
      task.ownerId,
      now
    )
  ).toMatchObject({ completedAt: null, checklist: [{ completed: true }] })
  expect(task.status).toBe("completed")
  expect(started.checklist[0].completed).toBe(false)
  expect(started.checklist).not.toBe(task.checklist)
})

test("new occurrences validate original slot membership and active owner, while historical checklists remain independent", () => {
  for (const occurrenceId of [
    null,
    `${id}:2026-10-08`,
    `${id}:2026-10-11`,
    `${entryId}:2026-10-07`,
    `${id}:2026-10-07T09:00`,
  ])
    expect(() =>
      applyLocalOccurrenceProgress(
        task,
        null,
        { ...status, occurrenceId },
        task.ownerId,
        now
      )
    ).toThrow()
  expect(() =>
    applyLocalOccurrenceProgress(task, null, status, "other-owner", now)
  ).toThrow()
  expect(() =>
    applyLocalOccurrenceProgress(
      { ...task, deletedAt: now },
      null,
      status,
      task.ownerId,
      now
    )
  ).toThrow()
  const historical = applyLocalOccurrenceProgress(
    task,
    null,
    { ...status, occurrenceId: `${id}:2026-10-09` },
    task.ownerId,
    now
  )
  const changed = {
    ...task,
    checklist: [],
    recurrence: task.recurrence
      ? { ...task.recurrence, end: { type: "count" as const, count: 1 } }
      : null,
  }
  expect(
    applyLocalOccurrenceProgress(
      changed,
      historical,
      {
        type: "task.set-checklist-entry",
        itemId: id,
        occurrenceId: historical.id,
        entryId,
        completed: true,
      },
      task.ownerId,
      later
    )
  ).toMatchObject({ checklist: [{ id: entryId, completed: true }] })
  for (const invalid of [
    { ...historical, cancelled: true },
    { ...historical, deletedAt: now },
    { ...historical, id: `${entryId}:2026-10-09`, seriesId: entryId },
  ])
    expect(() =>
      applyLocalOccurrenceProgress(
        task,
        invalid,
        { ...status, occurrenceId: historical.id },
        task.ownerId,
        now
      )
    ).toThrow()
  expect(() =>
    applyLocalOccurrenceProgress(
      task,
      historical,
      {
        type: "task.set-checklist-entry",
        itemId: id,
        occurrenceId: historical.id,
        entryId: id,
        completed: true,
      },
      task.ownerId,
      now
    )
  ).toThrow()
})
