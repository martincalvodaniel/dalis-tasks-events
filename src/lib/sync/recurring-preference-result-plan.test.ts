import { expect, test } from "bun:test"
import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import { planLocalPreferenceResult } from "@/lib/sync/preference-result-plan"
import { planLocalRecurringPreferenceResult } from "@/lib/sync/recurring-preference-result-plan"
import { planOccurrenceEntityKey } from "@/schemas/local-plan-occurrence-sync"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"

const timestamp = "2026-10-11T13:00:00.000Z"
function fixture() {
  const userId = "recurring-personal-result-owner",
    id = crypto.randomUUID(),
    tagId = crypto.randomUUID(),
    operationId = crypto.randomUUID(),
    senderId = crypto.randomUUID()
  const metadata = {
    revision: 3,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  const series = planSchema.parse({
    ...metadata,
    kind: "plan",
    variant: "task",
    id,
    ownerId: userId,
    title: "Series",
    description: "",
    status: "not_started",
    completedAt: null,
    checklist: [],
    schedule: {
      mode: "all_day",
      startDate: "2026-10-11",
      endDateExclusive: "2026-10-12",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-11",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
  })
  const record = {
    ...applyPlanOccurrenceCommand(
      series,
      null,
      {
        type: "plan.set-occurrence-status",
        itemId: id,
        occurrenceId: `${id}:2026-10-11`,
        status: "in_progress",
      },
      userId,
      timestamp
    ),
    revision: 2,
  }
  const shadow = {
    kind: "plan-occurrence" as const,
    version: 2 as const,
    userId,
    entityKey: planOccurrenceEntityKey(record.id),
    record,
    seriesRevision: 3,
  }
  const entry = outboxEntrySchema.parse({
    userId,
    entityKey: `tag:${tagId}`,
    operation: {
      operationId,
      protocolVersion: 1,
      baseRevision: 1,
      command: { type: "tag.delete", tagId },
    },
    state: "sending",
    attempts: 1,
    sequence: 1,
    dependencies: [],
    createdAt: timestamp,
    lease: { ownerId: senderId, expiresAt: "2026-10-11T13:01:00.000Z" },
  })
  const effect = {
    store: "tags" as const,
    record: {
      ...metadata,
      revision: 2,
      deletedAt: timestamp,
      id: tagId,
      userId,
      name: "Category",
      normalizedName: "category",
      color: "#123456",
      position: 1024,
    },
  }
  return {
    shadow,
    entry,
    input: {
      userId,
      items: [series],
      submission: {
        operation: entry.operation,
        senderId,
        result: {
          kind: "preference",
          outcome: {
            status: "applied",
            operationId,
            effects: {
              version: 1,
              userId,
              operationId,
              sequence: 5,
              effects: [effect],
            },
          },
        },
      },
      local: [],
      shadows: [shadow],
      entries: [entry],
      existingOutcome: null,
    },
  }
}
test("personal ACK preserves the complete appearance shadow while active planner stays strict", () => {
  const { input, shadow } = fixture(),
    before = structuredClone(input),
    plan = planLocalRecurringPreferenceResult(input)
  expect(plan.entries[0].state).toBe("acknowledged")
  expect(plan.shadows).toContainEqual(shadow)
  expect(plan.shadows).toHaveLength(2)
  expect(input).toEqual(before)
  const { items: _, ...old } = input
  expect(() => planLocalPreferenceResult(old)).toThrow()
  expect(
    planLocalRecurringPreferenceResult({
      ...input,
      shadows: plan.shadows,
      entries: plan.entries,
      existingOutcome: plan.outcome,
    }).status
  ).toBe("replayed")
})
test("only direct unattempted personal dependent rebases, appearance and attempted intentions remain frozen", () => {
  const value = fixture(),
    operation = value.entry.operation
  const direct = outboxEntrySchema.parse({
    ...value.entry,
    state: "pending",
    attempts: 0,
    lease: null,
    sequence: 2,
    dependencies: [operation.operationId],
    operation: {
      ...operation,
      operationId: crypto.randomUUID(),
      baseRevision: 0,
    },
  })
  const appearance = outboxEntrySchema.parse({
    ...direct,
    sequence: 3,
    entityKey: `item:${value.input.items[0].id}`,
    operation: {
      ...direct.operation,
      operationId: crypto.randomUUID(),
      baseRevision: 3,
      command: {
        type: "plan.set-occurrence-status",
        itemId: value.input.items[0].id,
        occurrenceId: value.shadow.record.id,
        expectedOccurrenceRevision: 2,
        status: "completed",
      },
    },
  })
  const tried = outboxEntrySchema.parse({
    ...direct,
    attempts: 1,
    sequence: 4,
    operation: { ...direct.operation, operationId: crypto.randomUUID() },
  })
  const plan = planLocalRecurringPreferenceResult({
    ...value.input,
    entries: [value.entry, direct, appearance, tried],
  })
  expect(plan.entries[1].operation.baseRevision).toBe(2)
  expect(plan.entries[2]).toEqual(appearance)
  expect(plan.entries[3]).toEqual(tried)
})
test("foreign or malformed appearance shadows, orphan parent, full queue and duplicate identities cannot be filtered", () => {
  const value = fixture()
  for (const invalid of [
    { ...value.input, items: [] },
    {
      ...value.input,
      items: [{ ...value.input.items[0], ownerId: "foreign" }],
    },
    { ...value.input, items: [...value.input.items, ...value.input.items] },
    { ...value.input, shadows: [value.shadow, value.shadow] },
    { ...value.input, shadows: [{ ...value.shadow, userId: "foreign" }] },
    { ...value.input, shadows: [{ ...value.shadow, seriesRevision: 0 }] },
    {
      ...value.input,
      entries: [{ ...value.entry, dependencies: [crypto.randomUUID()] }],
    },
    {
      ...value.input,
      shadows: Array.from({ length: 10001 }, () => value.shadow),
    },
  ])
    expect(() => planLocalRecurringPreferenceResult(invalid)).toThrow()
})
test("replay still requires durable matching outcome and own lease; unsupported is not ACK", () => {
  const value = fixture()
  expect(() =>
    planLocalRecurringPreferenceResult({
      ...value.input,
      submission: { ...value.input.submission, senderId: crypto.randomUUID() },
    })
  ).toThrow("lease")
  expect(() =>
    planLocalRecurringPreferenceResult({
      ...value.input,
      entries: [{ ...value.entry, state: "acknowledged", lease: null }],
    })
  ).toThrow("durable")
  const result = {
    kind: "preference",
    outcome: {
      status: "unsupported",
      operationId: value.entry.operation.operationId,
    },
  }
  const plan = planLocalRecurringPreferenceResult({
    ...value.input,
    submission: { ...value.input.submission, result },
  })
  expect(plan.entries[0].state).toBe("pending")
  expect(plan.shadows).toEqual([value.shadow])
})
