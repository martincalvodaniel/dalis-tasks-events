import { expect, test } from "bun:test"
import { readPlanOccurrenceRecoveryCohort } from "@/lib/sync/plan-occurrence-cohort"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceCohortInputSchema } from "@/schemas/plan-occurrence-cohort"

function fixture() {
  const userId = "appearance-cohort-owner",
    id = crypto.randomUUID(),
    now = "2026-10-19T03:25:00.000Z",
    series = planSchema.parse({
      kind: "plan",
      variant: "note",
      id,
      ownerId: userId,
      title: "Cohort",
      description: "",
      status: "not_started",
      completedAt: null,
      checklist: [],
      schedule: {
        mode: "all_day",
        startDate: "2026-10-18",
        endDateExclusive: "2026-10-19",
      },
      recurrence: {
        frequency: "daily",
        interval: 1,
        anchorDate: "2026-10-18",
        timeZone: "Europe/Madrid",
        end: { type: "count", count: 3 },
      },
      revision: 3,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }),
    root = outboxEntrySchema.parse({
      userId,
      entityKey: `item:${id}`,
      operation: {
        operationId: crypto.randomUUID(),
        protocolVersion: 1,
        baseRevision: 3,
        command: {
          type: "plan.set-occurrence-status",
          itemId: id,
          occurrenceId: `${id}:2026-10-18`,
          expectedOccurrenceRevision: 1,
          status: "in_progress",
        },
      },
      state: "conflict",
      attempts: 1,
      lease: null,
      sequence: 1,
      dependencies: [],
      createdAt: now,
    }),
    second = outboxEntrySchema.parse({
      ...root,
      state: "pending",
      attempts: 0,
      sequence: 2,
      dependencies: [root.operation.operationId],
      operation: {
        ...root.operation,
        operationId: crypto.randomUUID(),
        command: {
          ...root.operation.command,
          occurrenceId: `${id}:2026-10-19`,
          expectedOccurrenceRevision: 0,
        },
      },
    }),
    third = outboxEntrySchema.parse({
      ...root,
      state: "pending",
      attempts: 0,
      sequence: 3,
      dependencies: [second.operation.operationId],
      operation: {
        ...root.operation,
        operationId: crypto.randomUUID(),
        command: { ...root.operation.command, status: "completed" },
      },
    })
  return {
    userId,
    operationId: root.operation.operationId,
    series,
    entries: [root, second, third],
  }
}
test("multi-slot classification preserves interleaved global order and cross-slot dependency identity", () => {
  const f = fixture(),
    before = JSON.stringify(f),
    cohort = readPlanOccurrenceRecoveryCohort(f)
  expect(cohort.intentions).toEqual(f.entries)
  expect(cohort.slots.map((slot) => slot.occurrenceId)).toEqual([
    `${f.series.id}:2026-10-18`,
    `${f.series.id}:2026-10-19`,
  ])
  expect(cohort.slots[0].intentions).toEqual([f.entries[0], f.entries[2]])
  expect(cohort.slots[1].intentions).toEqual([f.entries[1]])
  expect(cohort.intentions[2].dependencies).toEqual([
    f.entries[1].operation.operationId,
  ])
  expect(cohort.acknowledgedDependencies).toEqual([])
  expect(JSON.stringify(f)).toBe(before)
})
test("single-slot history remains with its existing resolver rather than being silently broadened", () => {
  const f = fixture()
  expect(() =>
    readPlanOccurrenceRecoveryCohort({ ...f, entries: [f.entries[0]] })
  ).toThrow("at least two")
  expect(() =>
    readPlanOccurrenceRecoveryCohort({
      ...f,
      operationId: f.entries[1].operation.operationId,
    })
  ).toThrow("first conflict")
})
test("partial, duplicate, disconnected and uncertain intention graphs are rejected", () => {
  const f = fixture()
  for (const entries of [
    [f.entries[0], f.entries[2]],
    [...f.entries, f.entries[2]],
    [f.entries[0], { ...f.entries[1], dependencies: [] }, f.entries[2]],
    [f.entries[0], { ...f.entries[1], attempts: 1 }, f.entries[2]],
    [{ ...f.entries[0], attempts: 0 }, ...f.entries.slice(1)],
    [{ ...f.entries[0], state: "pending" }, ...f.entries.slice(1)],
    [{ ...f.entries[0], userId: "foreign" }, ...f.entries.slice(1)],
  ])
    expect(() => readPlanOccurrenceRecoveryCohort({ ...f, entries })).toThrow()
})
test("other parent operations and external dependents cannot be detached from the cohort", () => {
  const f = fixture(),
    other = outboxEntrySchema.parse({
      ...f.entries[1],
      sequence: 4,
      dependencies: [],
      entityKey: `item-view:${f.series.id}`,
      operation: {
        ...f.entries[1].operation,
        operationId: crypto.randomUUID(),
        command: {
          type: "item-view.set",
          itemId: f.series.id,
          primaryTagId: null,
        },
      },
    })
  expect(() =>
    readPlanOccurrenceRecoveryCohort({ ...f, entries: [...f.entries, other] })
  ).toThrow("another unresolved")
  const independent = {
    ...other,
    entityKey: `item-view:${crypto.randomUUID()}`,
    operation: {
      ...other.operation,
      command: { ...other.operation.command, itemId: crypto.randomUUID() },
    },
  }
  expect(() =>
    readPlanOccurrenceRecoveryCohort({
      ...f,
      entries: [...f.entries, independent],
    })
  ).toThrow()
  const target = crypto.randomUUID(),
    dependent = outboxEntrySchema.parse({
      ...other,
      entityKey: `item-view:${target}`,
      dependencies: [f.entries[2].operation.operationId],
      operation: {
        ...other.operation,
        command: { type: "item-view.set", itemId: target, primaryTagId: null },
      },
    })
  expect(() =>
    readPlanOccurrenceRecoveryCohort({
      ...f,
      entries: [...f.entries, dependent],
    })
  ).toThrow("external dependent")
})
test("transitive ACK DTO closure is preserved without claiming receipt or executor evidence", () => {
  const f = fixture(),
    a = outboxEntrySchema.parse({
      ...f.entries[0],
      state: "acknowledged",
      sequence: 1,
      operation: {
        ...f.entries[0].operation,
        operationId: crypto.randomUUID(),
      },
    }),
    b = outboxEntrySchema.parse({
      ...a,
      sequence: 2,
      dependencies: [a.operation.operationId],
      operation: { ...a.operation, operationId: crypto.randomUUID() },
    }),
    chain = f.entries.map((entry, index) => ({
      ...entry,
      sequence: entry.sequence + 2,
      dependencies:
        index === 0 ? [b.operation.operationId] : entry.dependencies,
    })),
    input = { ...f, entries: [a, b, ...chain] },
    cohort = readPlanOccurrenceRecoveryCohort(input)
  expect(cohort.acknowledgedDependencies).toEqual([a, b])
  expect(cohort.intentions).toEqual(chain)
  expect(() =>
    readPlanOccurrenceRecoveryCohort({
      ...input,
      entries: [{ ...a, state: "pending" }, b, ...chain],
    })
  ).toThrow()
  expect(() =>
    readPlanOccurrenceRecoveryCohort({ ...input, entries: [b, ...chain] })
  ).toThrow()
})
test("parent and slot validity, strict input and complete record limits stay guarded", () => {
  const f = fixture()
  for (const series of [
    { ...f.series, ownerId: "foreign" },
    { ...f.series, deletedAt: f.series.createdAt },
    { ...f.series, recurrence: null },
    { ...f.series, revision: 0 },
  ])
    expect(() => readPlanOccurrenceRecoveryCohort({ ...f, series })).toThrow()
  const entry = {
    ...f.entries[1],
    operation: {
      ...f.entries[1].operation,
      command: {
        ...f.entries[1].operation.command,
        occurrenceId: `${f.series.id}:2026-10-21`,
      },
    },
  }
  expect(() =>
    readPlanOccurrenceRecoveryCohort({
      ...f,
      entries: [f.entries[0], entry, f.entries[2]],
    })
  ).toThrow()
  expect(
    planOccurrenceCohortInputSchema.safeParse({ ...f, resolve: true }).success
  ).toBe(false)
  expect(
    planOccurrenceCohortInputSchema.safeParse({
      ...f,
      entries: Array(10001).fill(f.entries[0]),
    }).success
  ).toBe(false)
})
