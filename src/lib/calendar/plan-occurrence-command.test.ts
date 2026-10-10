import { expect, test } from "bun:test"
import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import { planOccurrencesPage } from "@/lib/calendar/plan-occurrences"
import { planSchema } from "@/schemas/plan-item"
import type { PlanVariant } from "@/types/plan-item"

const id = "00000000-0000-4000-8000-000000000011"
const entryId = "00000000-0000-4000-8000-000000000012"
const newEntryId = "00000000-0000-4000-8000-000000000013"
const now = "2026-10-10T08:00:00.000Z"
const later = "2026-10-10T09:00:00.000Z"
const actor = "occurrence-command-owner"
function series(variant: PlanVariant = "task") {
  return planSchema.parse({
    kind: "plan",
    variant,
    id,
    ownerId: actor,
    title: "Recurring plan",
    description: "Original description",
    schedule: {
      mode: "all_day",
      startDate: "2026-10-10",
      endDateExclusive: "2026-10-11",
    },
    status: "not_started",
    checklist: [{ id: entryId, text: "Original step", completed: false }],
    completedAt: null,
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-10",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
    revision: 3,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
}
const reference = { itemId: id, occurrenceId: `${id}:2026-10-11` }
const complete = {
  ...reference,
  type: "plan.set-occurrence-status",
  status: "completed",
}
const update = {
  ...reference,
  type: "plan.update-occurrence",
  input: {
    title: "Moved occurrence",
    description: "Local override",
    schedule: {
      mode: "all_day" as const,
      startDate: "2026-10-20",
      endDateExclusive: "2026-10-22",
    },
    checklist: [
      { id: entryId, text: "Renamed step" },
      { id: newEntryId, text: "New step" },
    ],
  },
}

test("all four variants complete and reopen only the addressed occurrence", () => {
  for (const variant of ["task", "event", "appointment", "note"] as const) {
    const parent = series(variant)
    const before = structuredClone(parent)
    const completed = applyPlanOccurrenceCommand(
      parent,
      null,
      complete,
      actor,
      later
    )
    expect(completed.id).toBe(reference.occurrenceId)
    expect(completed.status).toBe("completed")
    expect(completed.completedAt).toBe(later)
    expect(completed.createdAt).toBe(later)
    expect(completed.revision).toBe(0)
    const again = applyPlanOccurrenceCommand(
      parent,
      completed,
      complete,
      actor,
      "2026-10-10T10:00:00.000Z"
    )
    expect(again.completedAt).toBe(later)
    const opened = applyPlanOccurrenceCommand(
      parent,
      again,
      { ...complete, status: "in_progress" },
      actor,
      "2026-10-10T11:00:00.000Z"
    )
    expect(opened.status).toBe("in_progress")
    expect(opened.completedAt).toBeNull()
    expect(parent).toEqual(before)
    expect(
      planOccurrencesPage(parent, {
        startDate: "2026-10-12",
        endDate: "2026-10-12",
      }).occurrences[0].status
    ).toBe("not_started")
  }
})

test("checklist edits preserve step progress by identity and never mutate caller snapshots", () => {
  const parent = series("note")
  const progressed = applyPlanOccurrenceCommand(
    parent,
    null,
    {
      ...reference,
      type: "plan.set-occurrence-checklist-entry",
      entryId,
      completed: true,
    },
    actor,
    now
  )
  const before = structuredClone({ parent, progressed, update })
  const edited = applyPlanOccurrenceCommand(
    parent,
    progressed,
    update,
    actor,
    later
  )
  expect(edited.checklist).toEqual([
    { id: entryId, text: "Renamed step", completed: true },
    { id: newEntryId, text: "New step", completed: false },
  ])
  expect(edited.content).toEqual({
    title: "Moved occurrence",
    description: "Local override",
  })
  expect(edited.id).toBe(reference.occurrenceId)
  expect(edited.slotKey).toBe("2026-10-11")
  expect(edited.schedule).toEqual(update.input.schedule)
  edited.checklist[0].text = "Modified return value"
  expect({ parent, progressed, update }).toEqual(before)
  expect(() =>
    applyPlanOccurrenceCommand(
      parent,
      progressed,
      {
        ...reference,
        type: "plan.set-occurrence-checklist-entry",
        entryId: newEntryId,
        completed: true,
      },
      actor,
      later
    )
  ).toThrow("does not exist")
})

test("cancellation retains identity and blocks further editing or progress", () => {
  const parent = series("appointment")
  const current = applyPlanOccurrenceCommand(parent, null, update, actor, now)
  const cancelled = applyPlanOccurrenceCommand(
    parent,
    current,
    { ...reference, type: "plan.cancel-occurrence" },
    actor,
    later
  )
  expect(cancelled.cancelled).toBe(true)
  expect(cancelled.id).toBe(current.id)
  expect(cancelled.schedule).toEqual(current.schedule)
  for (const command of [
    complete,
    update,
    { ...reference, type: "plan.cancel-occurrence" },
  ])
    expect(() =>
      applyPlanOccurrenceCommand(parent, cancelled, command, actor, later)
    ).toThrow("does not exist")
})

test("authorization, parent lifecycle and exact original identity precede mutations", () => {
  const parent = series()
  const current = applyPlanOccurrenceCommand(parent, null, complete, actor, now)
  for (const invalid of [
    null,
    { ...parent, ownerId: "other" },
    { ...parent, deletedAt: now },
    { ...parent, recurrence: null },
    { ...parent, id: crypto.randomUUID() },
  ])
    expect(() =>
      applyPlanOccurrenceCommand(invalid, current, complete, actor, later)
    ).toThrow("permission")
  expect(() =>
    applyPlanOccurrenceCommand(parent, current, complete, "other", later)
  ).toThrow("permission")
  expect(() =>
    applyPlanOccurrenceCommand(
      parent,
      { ...current, deletedAt: now },
      complete,
      actor,
      later
    )
  ).toThrow("does not exist")
  expect(() =>
    applyPlanOccurrenceCommand(
      parent,
      current,
      { ...complete, occurrenceId: `${id}:2026-10-12` },
      actor,
      later
    )
  ).toThrow("does not exist")
  expect(() =>
    applyPlanOccurrenceCommand(
      parent,
      null,
      { ...complete, occurrenceId: `${crypto.randomUUID()}:2026-10-11` },
      actor,
      later
    )
  ).toThrow("different series")
})

test("nonexistent slots are rejected but stored exceptions keep their original slot after a series edit", () => {
  const parent = series()
  const current = applyPlanOccurrenceCommand(parent, null, update, actor, now)
  const weekly = planSchema.parse({
    ...parent,
    recurrence: {
      ...parent.recurrence,
      frequency: "weekly",
      interval: 1,
      anchorDate: "2026-10-10",
      timeZone: "Europe/Madrid",
      weekdays: [1],
      end: { type: "never" },
    },
  })
  expect(() =>
    applyPlanOccurrenceCommand(weekly, null, complete, actor, later)
  ).toThrow("does not exist")
  expect(
    applyPlanOccurrenceCommand(weekly, current, complete, actor, later).id
  ).toBe(reference.occurrenceId)
  const confirmed = { ...current, revision: 7 }
  expect(
    applyPlanOccurrenceCommand(parent, confirmed, complete, actor, later)
      .revision
  ).toBe(7)
})

test("DST-invalid edits cannot replace a valid stored schedule", () => {
  const parent = series("event")
  const current = applyPlanOccurrenceCommand(parent, null, complete, actor, now)
  const before = structuredClone(current)
  for (const localStart of ["2026-03-29T02:30", "2026-10-25T02:30"])
    expect(() =>
      applyPlanOccurrenceCommand(
        parent,
        current,
        {
          ...update,
          input: {
            ...update.input,
            schedule: {
              mode: "timed",
              localStart,
              localEnd: null,
              timeZone: "Europe/Madrid",
            },
          },
        },
        actor,
        later
      )
    ).toThrow()
  expect(current).toEqual(before)
  expect(() =>
    applyPlanOccurrenceCommand(
      parent,
      current,
      {
        ...update,
        input: {
          ...update.input,
          checklist: [...update.input.checklist, update.input.checklist[0]],
        },
      },
      actor,
      later
    )
  ).toThrow()
})
