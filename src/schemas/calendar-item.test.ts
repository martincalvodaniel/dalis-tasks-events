import { describe, expect, test } from "bun:test"
import { calendarItemDraftSchema } from "@/schemas/calendar-item"
import { itemOccurrenceSchema } from "@/schemas/occurrence"
import { recurrenceSchema } from "@/schemas/recurrence"
import { shareInvitationInputSchema } from "@/schemas/sharing"
import { syncBatchSchema, syncOperationSchema } from "@/schemas/sync"

const id = "b2d10a29-73af-4b53-a753-53e4dba1b110"
const task = {
  kind: "task",
  title: "Test task",
  description: "",
  scheduledDate: "2026-10-06",
  status: "not_started",
  checklist: [],
  recurrence: null,
} as const
const operation = {
  operationId: id,
  protocolVersion: 1,
  baseRevision: 0,
  command: { type: "item.create", itemId: id, input: task },
} as const

describe("calendar input contracts", () => {
  test("rejects impossible civil dates and incompatible item fields", () => {
    expect(calendarItemDraftSchema.safeParse(task).success).toBe(true)
    expect(
      calendarItemDraftSchema.safeParse({
        ...task,
        scheduledDate: "2026-02-30",
      }).success
    ).toBe(false)
    expect(
      calendarItemDraftSchema.safeParse({ ...task, title: "   " }).success
    ).toBe(false)
    expect(
      calendarItemDraftSchema.safeParse({ ...task, title: "x".repeat(161) })
        .success
    ).toBe(false)
    expect(
      calendarItemDraftSchema.safeParse({ ...task, ownerId: "someone-else" })
        .success
    ).toBe(false)
    const entry = { id, text: "Checklist point", completed: false }
    expect(
      calendarItemDraftSchema.safeParse({ ...task, checklist: [entry, entry] })
        .success
    ).toBe(false)
  })

  test("validates event duration, civil dates and time zones", () => {
    const event = {
      kind: "event",
      title: "Test event",
      description: "",
      recurrence: null,
    }
    expect(
      calendarItemDraftSchema.safeParse({
        ...event,
        schedule: {
          mode: "all_day",
          startDate: "2026-10-06",
          endDateExclusive: "2026-10-07",
        },
      }).success
    ).toBe(true)
    expect(
      calendarItemDraftSchema.safeParse({
        ...event,
        schedule: {
          mode: "all_day",
          startDate: "2026-10-06",
          endDateExclusive: "2026-10-06",
        },
      }).success
    ).toBe(false)
    for (const localEnd of [
      "2026-10-06T12:00",
      "2026-10-06T11:59",
      "2026-02-30T14:00",
    ]) {
      expect(
        calendarItemDraftSchema.safeParse({
          ...event,
          schedule: {
            mode: "timed",
            localStart: "2026-10-06T12:00",
            localEnd,
            timeZone: "Europe/Madrid",
          },
        }).success
      ).toBe(false)
    }
    expect(
      calendarItemDraftSchema.safeParse({
        ...event,
        schedule: {
          mode: "timed",
          localStart: "2026-10-06T12:00",
          localEnd: null,
          timeZone: "invalid-zone",
        },
      }).success
    ).toBe(false)
  })

  test("birthdays preserve leap days and exclude task state", () => {
    const birthday = {
      kind: "birthday",
      title: "Birthday",
      description: "",
      month: 2,
      day: 29,
      birthYear: null,
      timeZone: "Europe/Madrid",
    }
    expect(calendarItemDraftSchema.safeParse(birthday).success).toBe(true)
    expect(
      calendarItemDraftSchema.safeParse({ ...birthday, birthYear: 2023 })
        .success
    ).toBe(false)
    expect(
      calendarItemDraftSchema.safeParse({ ...birthday, month: 4, day: 31 })
        .success
    ).toBe(false)
    expect(
      calendarItemDraftSchema.safeParse({ ...birthday, status: "completed" })
        .success
    ).toBe(false)
  })

  test("recurrence validates weekdays and end bounds", () => {
    const rule = {
      frequency: "weekly",
      anchorDate: "2026-10-06",
      timeZone: "Europe/Madrid",
      interval: 1,
      weekdays: [1, 3],
      end: { type: "never" },
    }
    expect(recurrenceSchema.safeParse(rule).success).toBe(true)
    expect(
      recurrenceSchema.safeParse({ ...rule, weekdays: [1, 1] }).success
    ).toBe(false)
    expect(recurrenceSchema.safeParse({ ...rule, interval: 0 }).success).toBe(
      false
    )
    expect(
      recurrenceSchema.safeParse({
        ...rule,
        end: { type: "until", date: "2026-10-05" },
      }).success
    ).toBe(false)
  })

  test("occurrence identity stays attached to the original slot", () => {
    const occurrence = {
      ...task,
      id: `${id}:2026-10-06`,
      seriesId: id,
      slotKey: "2026-10-06",
      cancelled: false,
      scheduledDate: "2026-10-09",
      completedAt: null,
      revision: 0,
      deletedAt: null,
      createdAt: "2026-10-06T12:00:00.000Z",
      updatedAt: "2026-10-06T12:00:00.000Z",
    }
    const {
      title: _title,
      description: _description,
      recurrence: _recurrence,
      ...record
    } = occurrence
    expect(itemOccurrenceSchema.safeParse(record).success).toBe(true)
    expect(
      itemOccurrenceSchema.safeParse({ ...record, id: `${id}:2026-10-09` })
        .success
    ).toBe(false)
  })

  test("transport excludes ownership, bounds batches and rejects replay collisions", () => {
    expect(syncOperationSchema.safeParse(operation).success).toBe(true)
    expect(
      syncOperationSchema.safeParse({ ...operation, baseRevision: 2 }).success
    ).toBe(false)
    expect(
      syncOperationSchema.safeParse({ ...operation, actorId: "other-user" })
        .success
    ).toBe(false)
    expect(
      syncBatchSchema.safeParse({ operations: [operation, operation] }).success
    ).toBe(false)
    expect(
      syncBatchSchema.safeParse({ operations: Array(51).fill(operation) })
        .success
    ).toBe(false)
    const entries = Array.from({ length: 100 }, () => ({
      id: crypto.randomUUID(),
      text: "x".repeat(500),
      completed: false,
    }))
    expect(
      syncBatchSchema.safeParse({
        operations: Array.from({ length: 10 }, () => ({
          ...operation,
          operationId: crypto.randomUUID(),
          command: {
            ...operation.command,
            input: {
              ...task,
              description: "x".repeat(10000),
              checklist: entries,
            },
          },
        })),
      }).success
    ).toBe(false)
  })

  test("invitations normalize emails without rewriting Gmail aliases", () => {
    const invitation = shareInvitationInputSchema.parse({
      itemId: id,
      recipientEmail: " Person.Name+tag@Gmail.com ",
      role: "reader",
    })
    expect(invitation.recipientEmail).toBe("person.name+tag@gmail.com")
    expect(
      shareInvitationInputSchema.safeParse({
        itemId: id,
        recipientEmail: "invalid",
        role: "owner",
      }).success
    ).toBe(false)
  })
})
