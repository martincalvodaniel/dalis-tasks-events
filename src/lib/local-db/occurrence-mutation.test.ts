import { expect, test } from "bun:test"
import { occurrencesPage } from "@/lib/calendar/occurrences"
import { applyLocalOccurrenceCommand } from "@/lib/local-db/occurrence-mutation"
import { applyLocalOccurrenceProgress } from "@/lib/local-db/occurrence-progress"
import { taskSchema } from "@/schemas/calendar-item"
import { itemOccurrenceSchema } from "@/schemas/occurrence"
import { syncCommandSchema } from "@/schemas/sync"

const id = "8a7a7969-1d11-4f36-9ce3-c1b933e849c2"
const entryId = "2d464e90-7889-4e80-bcbc-9da82f29138b"
const newEntryId = "1bbc261b-a8ca-40b2-a655-8e7c77862396"
const now = "2026-10-07T10:00:00.000Z"
const later = "2026-10-08T10:00:00.000Z"
const task = taskSchema.parse({
  id,
  ownerId: "test-owner",
  title: "Template",
  description: "Template description",
  kind: "task",
  revision: 4,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  scheduledDate: "2026-10-07",
  status: "not_started",
  completedAt: null,
  checklist: [{ id: entryId, text: "Template step", completed: true }],
  recurrence: {
    frequency: "daily",
    anchorDate: "2026-10-07",
    timeZone: "Europe/Madrid",
    interval: 2,
    end: { type: "count", count: 2 },
  },
})
const update = {
  type: "task.update-occurrence" as const,
  itemId: id,
  occurrenceId: `${id}:2026-10-07`,
  input: {
    title: "  Edited occurrence  ",
    description: "Local content",
    scheduledDate: "2026-11-01",
    checklist: [
      { id: entryId, text: "Renamed step" },
      { id: newEntryId, text: "New step" },
    ],
  },
}
const cancel = {
  type: "task.cancel-occurrence" as const,
  itemId: id,
  occurrenceId: update.occurrenceId,
}

test("editing an occurrence preserves original identity, progress and independent checklist content", () => {
  const generated = occurrencesPage(task, {
    startDate: "2026-10-07",
    endDate: "2026-10-09",
  }).occurrences
  const checked = applyLocalOccurrenceProgress(
    task,
    null,
    {
      type: "task.set-checklist-entry",
      itemId: id,
      occurrenceId: update.occurrenceId,
      entryId,
      completed: true,
    },
    task.ownerId,
    now
  )
  const completed = applyLocalOccurrenceProgress(
    task,
    checked,
    {
      type: "task.set-status",
      itemId: id,
      occurrenceId: update.occurrenceId,
      status: "completed",
    },
    task.ownerId,
    now
  )
  const edited = applyLocalOccurrenceCommand(
    task,
    completed,
    update,
    task.ownerId,
    later
  )
  expect(edited).toMatchObject({
    id: update.occurrenceId,
    slotKey: "2026-10-07",
    scheduledDate: "2026-11-01",
    content: { title: "Edited occurrence", description: "Local content" },
    status: "completed",
    completedAt: now,
    revision: 0,
    createdAt: now,
    updatedAt: later,
  })
  expect(edited.checklist).toEqual([
    { id: entryId, text: "Renamed step", completed: true },
    { id: newEntryId, text: "New step", completed: false },
  ])
  expect(completed.checklist[0].text).toBe("Template step")
  expect(task.title).toBe("Template")
  expect(generated[1]).toMatchObject({
    scheduledDate: "2026-10-09",
    status: "not_started",
    checklist: [{ text: "Template step", completed: false }],
  })
  const rechecked = applyLocalOccurrenceProgress(
    { ...task, title: "Changed template", checklist: [] },
    edited,
    {
      type: "task.set-checklist-entry",
      itemId: id,
      occurrenceId: update.occurrenceId,
      entryId: newEntryId,
      completed: true,
    },
    task.ownerId,
    later
  )
  expect(rechecked.content).toEqual(edited.content)
  expect(rechecked.scheduledDate).toBe("2026-11-01")
  const removed = applyLocalOccurrenceCommand(
    task,
    rechecked,
    { ...update, input: { ...update.input, checklist: [] } },
    task.ownerId,
    later
  )
  expect(removed.checklist).toEqual([])
  expect(removed.completedAt).toBe(now)
})

test("first edit and cancellation materialize a single original slot and retain legacy records", () => {
  const first = applyLocalOccurrenceCommand(
    task,
    null,
    update,
    task.ownerId,
    later
  )
  expect(first.createdAt).toBe(later)
  expect(first.checklist.every((entry) => !entry.completed)).toBe(true)
  const frozen = applyLocalOccurrenceProgress(
    task,
    null,
    {
      type: "task.set-status",
      itemId: id,
      occurrenceId: update.occurrenceId,
      status: "in_progress",
    },
    task.ownerId,
    now
  )
  expect(frozen.content).toEqual({
    title: task.title,
    description: task.description,
  })
  const cancelled = applyLocalOccurrenceCommand(
    task,
    first,
    cancel,
    task.ownerId,
    later
  )
  expect(cancelled).toEqual({ ...first, cancelled: true, updatedAt: later })
  expect(first.cancelled).toBe(false)
  const otherCancel = applyLocalOccurrenceCommand(
    task,
    null,
    { ...cancel, occurrenceId: `${id}:2026-10-09` },
    task.ownerId,
    later
  )
  expect(otherCancel).toMatchObject({
    cancelled: true,
    scheduledDate: "2026-10-09",
    slotKey: "2026-10-09",
    content: { title: task.title },
  })
  const { content: _content, ...legacy } = frozen
  expect(itemOccurrenceSchema.safeParse(legacy).success).toBe(true)
  expect(
    applyLocalOccurrenceCommand(task, legacy, cancel, task.ownerId, later)
      .content
  ).toEqual(frozen.content)
  for (const invalid of [cancelled, { ...first, deletedAt: now }]) {
    expect(() =>
      applyLocalOccurrenceCommand(task, invalid, update, task.ownerId, later)
    ).toThrow()
    expect(() =>
      applyLocalOccurrenceProgress(
        task,
        invalid,
        {
          type: "task.set-status",
          itemId: id,
          occurrenceId: update.occurrenceId,
          status: "completed",
        },
        task.ownerId,
        later
      )
    ).toThrow()
  }
})

test("occurrence edit contracts exclude progress, recurrence, identity and invalid checklist input", () => {
  expect(syncCommandSchema.safeParse(update).success).toBe(true)
  expect(syncCommandSchema.safeParse(cancel).success).toBe(true)
  for (const input of [
    { ...update.input, status: "completed" },
    { ...update.input, recurrence: null },
    { ...update.input, id: id },
    { ...update.input, title: " " },
    { ...update.input, scheduledDate: "2026-02-30" },
    {
      ...update.input,
      checklist: [{ id: entryId, text: "Step", completed: true }],
    },
    {
      ...update.input,
      checklist: [
        { id: entryId, text: "One" },
        { id: entryId, text: "Two" },
      ],
    },
  ])
    expect(syncCommandSchema.safeParse({ ...update, input }).success).toBe(
      false
    )
  for (const occurrenceId of [
    `${id}:2026-10-08`,
    `${id}:2026-10-11`,
    `${newEntryId}:2026-10-07`,
    `${id}:2026-10-07T09:00`,
  ])
    expect(() =>
      applyLocalOccurrenceCommand(
        task,
        null,
        { ...update, occurrenceId },
        task.ownerId,
        now
      )
    ).toThrow()
  expect(() =>
    applyLocalOccurrenceCommand(task, null, update, "other-owner", now)
  ).toThrow()
  expect(() =>
    applyLocalOccurrenceCommand(
      { ...task, deletedAt: now },
      null,
      cancel,
      task.ownerId,
      now
    )
  ).toThrow()
})
