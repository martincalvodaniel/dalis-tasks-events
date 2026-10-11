import { expect, test } from "bun:test"
import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import { decodeLocalItemOutcome } from "@/lib/sync/local-item-outcome-v2"
import {
  decodeRemoteRecurringShadow,
  validateLocalPlanOccurrenceOutcome,
  validateLocalPlanOccurrenceResultInput,
} from "@/lib/sync/local-plan-occurrence-sync"
import { decodeRemoteShadow } from "@/lib/sync/remote-shadow-v2"
import { planOccurrenceEntityKey } from "@/schemas/local-plan-occurrence-sync"
import { remotePlanOccurrenceOperationSchema } from "@/schemas/remote-plan-occurrence-planning"
import { remotePlanOccurrenceResultSchema } from "@/schemas/remote-plan-occurrence-result"
import type { Plan } from "@/types/plan-item"

const actor = "appearance-evidence-owner"
const timestamp = "2026-10-11T13:00:00.000Z"
const seriesId = crypto.randomUUID(),
  entryId = crypto.randomUUID(),
  senderId = crypto.randomUUID()
const series: Plan = {
  kind: "plan",
  variant: "event",
  id: seriesId,
  ownerId: actor,
  title: "Series",
  description: "Parent",
  status: "not_started",
  completedAt: null,
  checklist: [{ id: entryId, text: "Step", completed: false }],
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
  revision: 3,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
}
const reference = {
  itemId: seriesId,
  occurrenceId: `${seriesId}:2026-10-11`,
  expectedOccurrenceRevision: 0,
}
const commands = [
  { ...reference, type: "plan.set-occurrence-status", status: "completed" },
  {
    ...reference,
    type: "plan.set-occurrence-checklist-entry",
    entryId,
    completed: true,
  },
  { ...reference, type: "plan.cancel-occurrence" },
  {
    ...reference,
    type: "plan.update-occurrence",
    input: {
      title: "Independent",
      description: "Appearance",
      schedule: {
        mode: "all_day",
        startDate: "2026-10-15",
        endDateExclusive: "2026-10-16",
      },
      checklist: [{ id: entryId, text: "Edited" }],
    },
  },
]
function submission(index = 0) {
  const operation = remotePlanOccurrenceOperationSchema.parse({
    operationId: crypto.randomUUID(),
    protocolVersion: 1,
    baseRevision: 3,
    command: commands[index],
  })
  const { expectedOccurrenceRevision, ...command } = operation.command
  const record = applyPlanOccurrenceCommand(
    series,
    null,
    command,
    actor,
    timestamp
  )
  const result = remotePlanOccurrenceResultSchema.parse({
    kind: "plan-occurrence",
    userId: actor,
    outcome: {
      operationId: operation.operationId,
      status: "applied",
      seriesRevision: 3,
      sequence: 5,
      occurrence: { ...record, revision: expectedOccurrenceRevision + 1 },
    },
  })
  return { senderId, operation, result }
}
function applied(index = 0) {
  const value = submission(index)
  if (value.result.outcome.status !== "applied")
    throw new Error("Applied fixture is missing")
  return { ...value, outcome: value.result.outcome }
}

test("four appearance families validate their exact submitted target and revisions without claiming a commit", () => {
  for (let index = 0; index < commands.length; index++) {
    const value = submission(index)
    expect(validateLocalPlanOccurrenceResultInput(value, actor)).toEqual(value)
  }
  for (let index = 0; index < commands.length; index++) {
    const { operation, result, outcome } = applied(index)
    const record = outcome.occurrence
    const forged = [
      { ...record, status: "not_started", completedAt: null },
      {
        ...record,
        checklist: [{ id: entryId, text: "Step", completed: false }],
      },
      { ...record, cancelled: false },
      { ...record, content: { title: "Other", description: "Appearance" } },
    ][index]
    expect(() =>
      validateLocalPlanOccurrenceResultInput(
        {
          senderId,
          operation,
          result: { ...result, outcome: { ...outcome, occurrence: forged } },
        },
        actor
      )
    ).toThrow()
  }
})

test("foreign actor, UUID, series, slot or revisions cannot become local appearance evidence", () => {
  const { operation, result, outcome } = applied()
  const base = { senderId, operation, result }
  const record = outcome.occurrence
  const foreignId = crypto.randomUUID()
  for (const value of [
    { ...base, result: { ...result, userId: "foreign" } },
    {
      ...base,
      result: {
        ...result,
        outcome: { ...outcome, operationId: crypto.randomUUID() },
      },
    },
    {
      ...base,
      result: { ...result, outcome: { ...outcome, seriesRevision: 4 } },
    },
    {
      ...base,
      result: {
        ...result,
        outcome: { ...outcome, occurrence: { ...record, revision: 7 } },
      },
    },
    {
      ...base,
      result: {
        ...result,
        outcome: {
          ...outcome,
          occurrence: {
            ...record,
            seriesId: foreignId,
            id: `${foreignId}:2026-10-11`,
          },
        },
      },
    },
    {
      ...base,
      result: {
        ...result,
        outcome: {
          ...outcome,
          occurrence: {
            ...record,
            slotKey: "2026-10-12",
            id: `${seriesId}:2026-10-12`,
          },
        },
      },
    },
  ])
    expect(() => validateLocalPlanOccurrenceResultInput(value, actor)).toThrow()
  const { expectedOccurrenceRevision, ...historic } = operation.command
  expect(() =>
    validateLocalPlanOccurrenceResultInput(
      { ...base, operation: { ...operation, command: historic } },
      actor
    )
  ).toThrow()
})

test("local snapshots can be newer than replayed evidence without treating the observed base as an ancestor", () => {
  const { operation, result, outcome } = applied()
  const input = {
    version: 2 as const,
    kind: "plan-occurrence" as const,
    key: `operation-outcome:${operation.operationId}`,
    operation,
    result,
    series: { ...series, revision: 9 },
    local: { ...outcome.occurrence, revision: 7 },
    base: { ...outcome.occurrence, revision: 6 },
  }
  expect(validateLocalPlanOccurrenceOutcome(input, actor)).toEqual(input)
  expect(
    validateLocalPlanOccurrenceOutcome(
      { ...input, local: null, base: null, series: null },
      actor
    )
  ).toMatchObject({ local: null, base: null, series: null })
  for (const value of [
    { ...input, key: "operation-outcome:wrong" },
    { ...input, series: { ...series, ownerId: "foreign" } },
    {
      ...input,
      base: {
        ...outcome.occurrence,
        slotKey: "2026-10-12",
        id: `${seriesId}:2026-10-12`,
      },
    },
  ])
    expect(() => validateLocalPlanOccurrenceOutcome(value, actor)).toThrow()
  expect(() => decodeLocalItemOutcome(input, actor)).toThrow()
})

test("future shadow identity is independent of parent; old shadows adapt unchanged and active readers stay strict", () => {
  const { outcome } = applied()
  const input = {
    version: 2 as const,
    kind: "plan-occurrence" as const,
    userId: actor,
    entityKey: planOccurrenceEntityKey(outcome.occurrence.id),
    seriesRevision: 3,
    record: outcome.occurrence,
  }
  expect(decodeRemoteRecurringShadow(input, actor)).toEqual(input)
  expect(() => decodeRemoteShadow(input, actor)).toThrow()
  const legacy = { entityKey: `item:${seriesId}`, record: series }
  const snapshot = structuredClone(legacy)
  expect(decodeRemoteRecurringShadow(legacy, actor)).toEqual({
    ...legacy,
    version: 2,
    kind: "item",
  })
  expect(legacy).toEqual(snapshot)
  for (const value of [
    { ...input, userId: "foreign" },
    { ...input, entityKey: `item:${seriesId}` },
    { ...input, version: 3 },
    { ...input, record: { ...input.record, revision: 0 } },
  ])
    expect(() => decodeRemoteRecurringShadow(value, actor)).toThrow()
})

test("conflict and terminal outcomes retain explicit absence and current parent ownership", () => {
  const value = submission()
  const conflict = {
    ...value,
    result: {
      ...value.result,
      outcome: {
        status: "conflict",
        operationId: value.operation.operationId,
        series,
        current: null,
      },
    },
  }
  expect(validateLocalPlanOccurrenceResultInput(conflict, actor)).toMatchObject(
    { result: { outcome: { current: null } } }
  )
  expect(() =>
    validateLocalPlanOccurrenceResultInput(
      {
        ...conflict,
        result: {
          ...conflict.result,
          outcome: {
            ...conflict.result.outcome,
            series: { ...series, ownerId: "foreign" },
          },
        },
      },
      actor
    )
  ).toThrow()
  for (const status of [
    "unavailable",
    "unsupported",
    "invalid_command",
    "identity_reuse",
  ] as const)
    expect(
      validateLocalPlanOccurrenceResultInput(
        {
          ...value,
          result: {
            ...value.result,
            outcome: { status, operationId: value.operation.operationId },
          },
        },
        actor
      ).result.outcome.status
    ).toBe(status)
})
