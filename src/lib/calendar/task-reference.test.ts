import { expect, test } from "bun:test"
import { occurrencesPage } from "@/lib/calendar/occurrences"
import { createTaskReferenceIndex } from "@/lib/calendar/task-reference"
import { taskSchema } from "@/schemas/calendar-item"

const id = "8a7a7969-1d11-4f36-9ce3-c1b933e849c2"
const simpleId = "1bbc261b-a8ca-40b2-a655-8e7c77862396"
const entryId = "2d464e90-7889-4e80-bcbc-9da82f29138b"
const now = "2026-10-07T10:00:00.000Z"
const parent = taskSchema.parse({
  id,
  ownerId: "reference-owner",
  kind: "task",
  title: "Test reference",
  description: "",
  scheduledDate: "2026-10-07",
  status: "completed",
  completedAt: now,
  checklist: [{ id: entryId, text: "Template", completed: true }],
  recurrence: {
    frequency: "daily",
    anchorDate: "2026-10-07",
    timeZone: "Europe/Madrid",
    interval: 2,
    end: { type: "count", count: 2 },
  },
  revision: 4,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
})
const simple = taskSchema.parse({ ...parent, id: simpleId, recurrence: null })
const slot = `${id}:2026-10-07`

test("references resolve simple tasks or original recurring slots with copies and independent progress", () => {
  const original = JSON.stringify([parent, simple])
  const index = createTaskReferenceIndex([parent, simple], [], parent.ownerId)
  expect(index.resolve(simpleId)?.record).toEqual(simple)
  expect(index.resolve(id)).toBeNull()
  const virtual = index.resolve(slot)
  expect(virtual).toMatchObject({
    parent: { id },
    record: {
      id: slot,
      scheduledDate: "2026-10-07",
      status: "not_started",
      checklist: [{ completed: false }],
    },
  })
  if (!virtual || !("seriesId" in virtual.record))
    throw new Error("Virtual test reference is missing")
  virtual.record.checklist[0].text = "Caller mutation"
  virtual.parent.title = "Caller parent mutation"
  expect(index.resolve(slot)?.record.checklist[0].text).toBe("Template")
  expect(index.resolve(slot)?.parent.title).toBe(parent.title)
  expect(JSON.stringify([parent, simple])).toBe(original)
  for (const reference of [
    `${id}:2026-10-08`,
    `${id}:2026-10-11`,
    `${simpleId}:2026-10-07`,
    `${entryId}:2026-10-07`,
  ])
    expect(index.resolve(reference)).toBeNull()
  for (const invalid of [
    "missing",
    `${id}:2026-02-30`,
    `${id}:2026-10-07T09:00`,
  ])
    expect(() => index.resolve(invalid)).toThrow()
})

test("historical reprogrammed references survive a closed future rule but cancelled or foreign references disappear", () => {
  const generated = occurrencesPage(parent, {
    startDate: "2026-10-09",
    endDate: "2026-10-09",
  }).occurrences[0]
  if (generated?.kind !== "task") throw new Error("Test occurrence is missing")
  const exception = {
    ...generated,
    scheduledDate: "2026-11-01",
    status: "in_progress" as const,
    content: { title: "Own content", description: "" },
    checklist: [{ id: entryId, text: "Historic step", completed: true }],
  }
  const changed = taskSchema.parse({
    ...parent,
    checklist: [],
    recurrence: { ...parent.recurrence, end: { type: "count", count: 1 } },
  })
  const index = createTaskReferenceIndex([changed], [exception], parent.ownerId)
  expect(index.resolve(exception.id)).toMatchObject({
    record: {
      id: exception.id,
      slotKey: "2026-10-09",
      scheduledDate: "2026-11-01",
      status: "in_progress",
      content: { title: "Own content" },
      checklist: [{ text: "Historic step", completed: true }],
    },
  })
  for (const record of [
    { ...exception, cancelled: true },
    { ...exception, deletedAt: now },
  ])
    expect(
      createTaskReferenceIndex([changed], [record], parent.ownerId).resolve(
        exception.id
      )
    ).toBeNull()
  for (const excluded of [
    { ...changed, ownerId: "foreign-owner" },
    { ...changed, deletedAt: now },
    { ...changed, recurrence: null },
  ])
    expect(
      createTaskReferenceIndex([excluded], [exception], parent.ownerId).resolve(
        exception.id
      )
    ).toBeNull()
  expect(
    createTaskReferenceIndex([], [exception], parent.ownerId).resolve(
      exception.id
    )
  ).toBeNull()
  expect(() =>
    createTaskReferenceIndex([changed, changed], [], parent.ownerId)
  ).toThrow()
  expect(() =>
    createTaskReferenceIndex([changed], [exception, exception], parent.ownerId)
  ).toThrow()
  expect(() =>
    createTaskReferenceIndex(
      [changed],
      [{ ...exception, slotKey: "2026-10-10" }],
      parent.ownerId
    )
  ).toThrow()
})

test("single-slot lookup jumps to remote civil years without scanning recurrence history", () => {
  const long = taskSchema.parse({
    ...parent,
    scheduledDate: "0001-01-01",
    recurrence: {
      frequency: "daily",
      anchorDate: "0001-01-01",
      timeZone: "Europe/Madrid",
      interval: 1,
      end: { type: "never" },
    },
  })
  const index = createTaskReferenceIndex([long], [], long.ownerId)
  for (const date of ["0001-01-01", "0004-02-29", "1900-03-01", "9999-12-31"])
    expect(index.resolve(`${id}:${date}`)?.record.scheduledDate).toBe(date)
})
