import { describe, expect, test } from "bun:test"
import { applyItemCommand } from "@/lib/calendar/item-command"
import { taskSchema } from "@/schemas/calendar-item"
import { outboxEntrySchema } from "@/schemas/local-sync"

const id = "1ac1bbf2-7b8d-4f2f-bffe-e50681593b01"
const operationId = "5dff9fe1-37a5-4027-953f-5c5d837b9f8b"
const now = "2026-10-06T09:00:00.000Z"
const task = taskSchema.parse({
  id,
  ownerId: "test-owner",
  kind: "task",
  title: "Test task",
  description: "",
  scheduledDate: "2026-10-06",
  status: "not_started",
  checklist: [],
  recurrence: null,
  completedAt: null,
  revision: 4,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
})

describe("shared item mutations", () => {
  test("checklist progress merges by entry ID without completing the task", () => {
    const firstId = "4ff5fb0e-6cd1-4334-927a-debc002cfbdd"
    const secondId = "b5a9ef82-64f2-411c-a69f-744e0862d787"
    const original = {
      ...task,
      checklist: [
        { id: firstId, text: "First step", completed: false },
        { id: secondId, text: "Second step", completed: false },
      ],
    }
    const command = {
      type: "task.set-checklist-entry" as const,
      itemId: id,
      occurrenceId: null,
      entryId: firstId,
      completed: true,
    }
    const first = applyItemCommand(original, command, task.ownerId, now)
    const second = applyItemCommand(
      first,
      { ...command, entryId: secondId },
      task.ownerId,
      now
    )
    if (second.kind !== "task") throw new Error("Unexpected kind")
    expect(second.checklist.every((entry) => entry.completed)).toBe(true)
    expect(second.status).toBe("not_started")
    expect(second.completedAt).toBeNull()
    expect(second.scheduledDate).toBe(task.scheduledDate)
    expect(second.revision).toBe(task.revision)
    const unchecked = applyItemCommand(
      second,
      { ...command, completed: false },
      task.ownerId,
      now
    )
    if (unchecked.kind !== "task") throw new Error("Unexpected kind")
    expect(unchecked.checklist[0].completed).toBe(false)
    expect(unchecked.checklist[1].completed).toBe(true)
    expect(() => applyItemCommand(task, command, task.ownerId, now)).toThrow(
      "Checklist entry does not exist"
    )
    expect(() =>
      applyItemCommand(
        original,
        { ...command, occurrenceId: `${id}:2026-10-06` },
        task.ownerId,
        now
      )
    ).toThrow()
  })
  test("completion and reopening preserve the remote revision and original schedule", () => {
    const completed = applyItemCommand(
      task,
      {
        type: "task.set-status",
        itemId: id,
        occurrenceId: null,
        status: "completed",
      },
      task.ownerId,
      now
    )
    expect(completed.kind).toBe("task")
    if (completed.kind !== "task") throw new Error("Unexpected kind")
    expect(completed.completedAt).toBe(now)
    expect(completed.revision).toBe(4)
    const reopened = applyItemCommand(
      completed,
      {
        type: "task.set-status",
        itemId: id,
        occurrenceId: null,
        status: "in_progress",
      },
      task.ownerId,
      now
    )
    expect(reopened).toEqual({ ...task, status: "in_progress" })
  })

  test("deleted or foreign items cannot be mutated or resurrected", () => {
    const command = { type: "item.delete" as const, itemId: id }
    expect(() => applyItemCommand(task, command, "other-owner", now)).toThrow()
    expect(() =>
      applyItemCommand({ ...task, deletedAt: now }, command, task.ownerId, now)
    ).toThrow()
    expect(() =>
      applyItemCommand(
        task,
        {
          type: "item.create",
          itemId: id,
          input: {
            kind: "birthday",
            title: "Test birthday",
            description: "",
            month: 10,
            day: 6,
            birthYear: null,
            timeZone: "Europe/Madrid",
          },
        },
        task.ownerId,
        now
      )
    ).toThrow()
  })

  test("series status requires its individual occurrence layer", () => {
    const command = {
      type: "task.set-status" as const,
      itemId: id,
      occurrenceId: null,
      status: "completed" as const,
    }
    expect(() =>
      applyItemCommand(
        {
          ...task,
          recurrence: {
            frequency: "daily",
            interval: 1,
            anchorDate: task.scheduledDate,
            timeZone: "Europe/Madrid",
            end: { type: "never" },
          },
        },
        command,
        task.ownerId,
        now
      )
    ).toThrow()
    expect(() =>
      applyItemCommand(
        task,
        { ...command, occurrenceId: `${id}:2026-10-06` },
        task.ownerId,
        now
      )
    ).toThrow()
  })

  test("outbox validates identity, dependencies and lease state", () => {
    const entry = {
      userId: task.ownerId,
      entityKey: `item:${id}`,
      sequence: 1,
      operation: {
        operationId,
        protocolVersion: 1,
        baseRevision: 4,
        command: { type: "item.delete", itemId: id },
      },
      dependencies: [],
      state: "pending",
      attempts: 0,
      createdAt: now,
      lease: null,
    }
    expect(outboxEntrySchema.safeParse(entry).success).toBe(true)
    expect(
      outboxEntrySchema.safeParse({ ...entry, state: "sending" }).success
    ).toBe(false)
    expect(
      outboxEntrySchema.safeParse({ ...entry, dependencies: [operationId] })
        .success
    ).toBe(false)
    expect(
      outboxEntrySchema.safeParse({
        ...entry,
        entityKey: `item:${operationId}`,
      }).success
    ).toBe(false)
  })
})
