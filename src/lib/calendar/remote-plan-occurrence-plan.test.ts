import { expect, test } from "bun:test"
import { planOccurrencesPage } from "@/lib/calendar/plan-occurrences"
import { planRemotePlanOccurrenceOperation } from "@/lib/calendar/remote-plan-occurrence-plan"
import { planSchema } from "@/schemas/plan-item"
import { remotePlanOccurrenceOperationSchema } from "@/schemas/remote-plan-occurrence-planning"
import type { Plan } from "@/types/plan-item"

const id = "00000000-0000-4000-8000-000000000001"
const stepId = "00000000-0000-4000-8000-000000000002"
const actor = "recurrence-planner-owner"
const now = "2026-10-11T09:00:00.000Z"
const later = "2026-10-11T10:00:00.000Z"
function series(variant: Plan["variant"] = "task") {
  return planSchema.parse({
    kind: "plan",
    variant,
    id,
    ownerId: actor,
    title: "Recurring",
    description: "Parent content",
    schedule: {
      mode: "all_day",
      startDate: "2026-10-10",
      endDateExclusive: "2026-10-11",
    },
    status: "not_started",
    completedAt: null,
    checklist: [{ id: stepId, text: "Step", completed: false }],
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
function operation(
  expectedOccurrenceRevision = 0,
  type: string = "plan.set-occurrence-status"
) {
  return {
    operationId: "00000000-0000-4000-8000-000000000003",
    protocolVersion: 1,
    baseRevision: 3,
    command: {
      type,
      itemId: id,
      occurrenceId: `${id}:2026-10-11`,
      expectedOccurrenceRevision,
      ...(type === "plan.set-occurrence-status" ? { status: "completed" } : {}),
    },
  }
}
function input() {
  return {
    userId: actor,
    timestamp: later,
    operation: operation(),
    series: series(),
    current: null,
  }
}

function changes(value: unknown) {
  const result = planRemotePlanOccurrenceOperation(value)
  if (result.status !== "changes")
    throw new Error(`Expected changes, received ${result.status}`)
  return result
}

test("new occurrence intents require explicit CAS without reinterpreting parent baseRevision", () => {
  const command = operation().command
  const { expectedOccurrenceRevision: _, ...historical } = command
  expect(
    remotePlanOccurrenceOperationSchema.safeParse({
      ...operation(),
      command: historical,
    }).success
  ).toBe(false)
  for (const invalid of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1])
    expect(
      remotePlanOccurrenceOperationSchema.safeParse({
        ...operation(),
        command: { ...command, expectedOccurrenceRevision: invalid },
      }).success
    ).toBe(false)
  expect(
    remotePlanOccurrenceOperationSchema.parse(operation(7)).baseRevision
  ).toBe(3)
})

test("first materialization advances only its own revision in every variant", () => {
  for (const variant of ["task", "event", "appointment", "note"] as const) {
    const snapshot = { ...input(), series: series(variant) },
      before = structuredClone(snapshot)
    const result = changes(snapshot)
    expect(result).toMatchObject({
      expectedSeriesRevision: 3,
      expectedOccurrenceRevision: 0,
      currentExists: false,
      record: {
        revision: 1,
        createdAt: later,
        updatedAt: later,
        completedAt: later,
        slotKey: "2026-10-11",
        status: "completed",
        content: { title: "Recurring", description: "Parent content" },
      },
    })
    expect(snapshot).toEqual(before)
    const other = planOccurrencesPage(snapshot.series, {
      startDate: "2026-10-12",
      endDate: "2026-10-12",
    }).occurrences[0]
    expect(other).toMatchObject({
      revision: 0,
      status: "not_started",
      completedAt: null,
    })
    expect(result.record.id).toBe(operation().command.occurrenceId)
  }
})

test("confirmed appearance revision is independent of parent revision and stale CAS conflicts", () => {
  const current = { ...changes(input()).record, revision: 7 }
  const snapshot = { ...input(), operation: operation(7), current }
  const result = changes(snapshot)
  expect(result).toMatchObject({
    expectedSeriesRevision: 3,
    expectedOccurrenceRevision: 7,
    currentExists: true,
    record: { revision: 8, createdAt: later, completedAt: later },
  })
  expect(
    planRemotePlanOccurrenceOperation({ ...snapshot, operation: operation(6) })
  ).toMatchObject({
    status: "conflict",
    current: { revision: 7 },
    series: { revision: 3 },
  })
  expect(
    planRemotePlanOccurrenceOperation({
      ...snapshot,
      series: { ...snapshot.series, revision: 4 },
    })
  ).toMatchObject({ status: "conflict", series: { revision: 4 } })
  expect(
    planRemotePlanOccurrenceOperation({ ...input(), operation: operation(1) })
  ).toEqual({ status: "unavailable" })
  expect(current.revision).toBe(7)
  const replayTimestamp = "2026-10-11T11:00:00.000Z"
  expect(
    changes({ ...snapshot, timestamp: replayTimestamp }).record.completedAt
  ).toBe(later)
})

test("ownership and parent lifecycle hide snapshots before any CAS conflict", () => {
  const current = changes(input()).record
  for (const parent of [
    null,
    { ...series(), ownerId: "other" },
    { ...series(), id: crypto.randomUUID() },
    { ...series(), deletedAt: now },
    { ...series(), recurrence: null },
  ])
    expect(
      planRemotePlanOccurrenceOperation({
        ...input(),
        series: parent,
        current,
        operation: operation(100),
      })
    ).toEqual({ status: "unavailable" })
  expect(
    planRemotePlanOccurrenceOperation({ ...input(), userId: "other", current })
  ).toEqual({ status: "unavailable" })
  expect(
    planRemotePlanOccurrenceOperation({
      ...input(),
      operation: {
        ...operation(),
        command: {
          ...operation().command,
          occurrenceId: `${crypto.randomUUID()}:2026-10-11`,
        },
      },
    })
  ).toEqual({ status: "invalid_command" })
  expect(
    planRemotePlanOccurrenceOperation({
      ...input(),
      current: { ...current, id: `${id}:2026-10-12`, slotKey: "2026-10-12" },
    })
  ).toEqual({ status: "invalid_command" })
})

test("step edits, movement and cancellation preserve slot, progress and parent", () => {
  const snapshot = input()
  const progressed = changes({
    ...snapshot,
    operation: {
      ...operation(),
      command: {
        type: "plan.set-occurrence-checklist-entry",
        itemId: id,
        occurrenceId: `${id}:2026-10-11`,
        expectedOccurrenceRevision: 0,
        entryId: stepId,
        completed: true,
      },
    },
  }).record
  const update = {
    ...operation(1),
    command: {
      type: "plan.update-occurrence",
      itemId: id,
      occurrenceId: progressed.id,
      expectedOccurrenceRevision: 1,
      input: {
        title: "Moved",
        description: "Override",
        schedule: {
          mode: "all_day",
          startDate: "2026-10-20",
          endDateExclusive: "2026-10-22",
        },
        checklist: [{ id: stepId, text: "Renamed" }],
      },
    },
  }
  const moved = changes({
    ...snapshot,
    current: progressed,
    operation: update,
  }).record
  expect(moved).toMatchObject({
    id: progressed.id,
    slotKey: "2026-10-11",
    revision: 2,
    content: { title: "Moved" },
    checklist: [{ id: stepId, text: "Renamed", completed: true }],
    schedule: update.command.input.schedule,
  })
  const weekly = {
    ...snapshot.series,
    recurrence: {
      ...snapshot.series.recurrence,
      frequency: "weekly",
      weekdays: [1],
      interval: 1,
      anchorDate: "2026-10-10",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
  }
  expect(
    changes({
      ...snapshot,
      series: weekly,
      current: moved,
      operation: operation(2),
    }).record.id
  ).toBe(moved.id)
  expect(
    planRemotePlanOccurrenceOperation({ ...snapshot, series: weekly })
  ).toEqual({ status: "invalid_command" })
  const cancelled = changes({
    ...snapshot,
    current: moved,
    operation: operation(2, "plan.cancel-occurrence"),
  }).record
  expect(cancelled).toMatchObject({
    revision: 3,
    cancelled: true,
    id: moved.id,
    schedule: moved.schedule,
  })
  expect(
    planRemotePlanOccurrenceOperation({
      ...snapshot,
      current: cancelled,
      operation: operation(3),
    })
  ).toEqual({ status: "unavailable" })
  expect(
    planRemotePlanOccurrenceOperation({
      ...snapshot,
      current: { ...moved, deletedAt: later },
      operation: operation(2),
    })
  ).toEqual({ status: "unavailable" })
  expect(snapshot.series.status).toBe("not_started")
})

test("invalid slot, DST edit, missing step and revision overflow never return mutations", () => {
  const snapshot = input(),
    current = changes(snapshot).record
  expect(
    planRemotePlanOccurrenceOperation({
      ...snapshot,
      operation: {
        ...operation(),
        command: { ...operation().command, occurrenceId: `${id}:2026-10-09` },
      },
    })
  ).toEqual({ status: "invalid_command" })
  expect(
    planRemotePlanOccurrenceOperation({
      ...snapshot,
      current: { ...current, revision: Number.MAX_SAFE_INTEGER },
      operation: operation(Number.MAX_SAFE_INTEGER),
    })
  ).toEqual({ status: "invalid_command" })
  for (const localStart of ["2026-03-29T02:30", "2026-10-25T02:30"])
    expect(
      planRemotePlanOccurrenceOperation({
        ...snapshot,
        current,
        operation: {
          ...operation(1),
          command: {
            type: "plan.update-occurrence",
            itemId: id,
            occurrenceId: current.id,
            expectedOccurrenceRevision: 1,
            input: {
              title: "DST",
              description: "",
              schedule: {
                mode: "timed",
                localStart,
                localEnd: null,
                timeZone: "Europe/Madrid",
              },
              checklist: [],
            },
          },
        },
      })
    ).toEqual({ status: "invalid_command" })
  expect(
    planRemotePlanOccurrenceOperation({
      ...snapshot,
      current,
      operation: {
        ...operation(1),
        command: {
          type: "plan.set-occurrence-checklist-entry",
          itemId: id,
          occurrenceId: current.id,
          expectedOccurrenceRevision: 1,
          entryId: crypto.randomUUID(),
          completed: true,
        },
      },
    })
  ).toEqual({ status: "invalid_command" })
})
