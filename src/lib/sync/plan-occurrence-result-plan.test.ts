import { expect, test } from "bun:test"
import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import { planRemotePlanOccurrenceProjection } from "@/lib/sync/plan-occurrence-projection"
import { planLocalPlanOccurrenceResult } from "@/lib/sync/plan-occurrence-result-plan"
import { planOccurrenceEntityKey } from "@/schemas/local-plan-occurrence-sync"
import { planSchema } from "@/schemas/plan-item"
import { remotePlanOccurrenceOperationSchema } from "@/schemas/remote-plan-occurrence-planning"
import type { OutboxEntry } from "@/types/local-sync"
import type { RemotePlanOccurrenceShadow } from "@/types/remote-recurring-sync"

const timestamp = "2026-10-11T13:00:00.000Z"
function fixture() {
  const userId = "appearance-plan-owner",
    id = crypto.randomUUID(),
    senderId = crypto.randomUUID()
  const series = planSchema.parse({
    kind: "plan",
    variant: "note",
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
    revision: 3,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  })
  const operation = remotePlanOccurrenceOperationSchema.parse({
    operationId: crypto.randomUUID(),
    protocolVersion: 1,
    baseRevision: 3,
    command: {
      type: "plan.set-occurrence-status",
      itemId: id,
      occurrenceId: `${id}:2026-10-11`,
      expectedOccurrenceRevision: 0,
      status: "completed",
    },
  })
  const { expectedOccurrenceRevision, ...command } = operation.command
  const record = applyPlanOccurrenceCommand(
    series,
    null,
    command,
    userId,
    timestamp
  )
  const entry: OutboxEntry = {
    userId,
    entityKey: `item:${id}`,
    operation,
    sequence: 1,
    state: "sending",
    attempts: 1,
    lease: { ownerId: senderId, expiresAt: "2026-10-11T13:01:00.000Z" },
    createdAt: timestamp,
    dependencies: [],
  }
  return {
    userId,
    series,
    local: record,
    entries: [entry],
    shadows: [] as RemotePlanOccurrenceShadow[],
    existingOutcome: null,
    submission: {
      senderId,
      operation,
      result: {
        kind: "plan-occurrence" as const,
        userId,
        outcome: {
          status: "applied" as const,
          operationId: operation.operationId,
          seriesRevision: 3,
          sequence: 5,
          occurrence: { ...record, revision: expectedOccurrenceRevision + 1 },
        },
      },
    },
  }
}
function dependent(
  value: ReturnType<typeof fixture>,
  sequence: number,
  changes: {
    occurrenceId?: string
    attempts?: number
    dependency?: string
    historical?: boolean
  } = {}
): OutboxEntry {
  return {
    ...value.entries[0],
    sequence,
    state: "pending",
    attempts: changes.attempts ?? 0,
    lease: null,
    dependencies: [
      changes.dependency ?? value.submission.operation.operationId,
    ],
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 3,
      command: {
        type: "plan.set-occurrence-status",
        itemId: value.series.id,
        occurrenceId:
          changes.occurrenceId ??
          value.submission.operation.command.occurrenceId,
        status: "not_started",
        ...(changes.historical ? {} : { expectedOccurrenceRevision: 0 }),
      },
    },
  }
}
function shadow(
  value: ReturnType<typeof fixture>,
  revision: number
): RemotePlanOccurrenceShadow {
  return {
    version: 2,
    kind: "plan-occurrence",
    userId: value.userId,
    entityKey: planOccurrenceEntityKey(value.local.id),
    seriesRevision: 3,
    record: {
      ...value.submission.result.outcome.occurrence,
      revision,
      status: "not_started",
      completedAt: null,
    },
  }
}
function projection(
  value: ReturnType<typeof fixture>,
  entries = value.entries
) {
  return {
    userId: value.userId,
    key: { seriesId: value.series.id, id: value.local.id },
    series: value.series,
    local: value.local,
    shadow: null,
    incoming: shadow(value, 2),
    entries,
  }
}

test("one applied appearance result produces an exact replay plan and preserves parent revision", () => {
  const value = fixture(),
    snapshot = structuredClone(value)
  const plan = planLocalPlanOccurrenceResult(value)
  expect(plan.entries[0]).toMatchObject({
    state: "acknowledged",
    lease: null,
    operation: { baseRevision: 3 },
  })
  expect(plan.local).toEqual(value.submission.result.outcome.occurrence)
  expect(plan.shadows).toHaveLength(1)
  expect(plan.outcome).toMatchObject({
    local: value.local,
    base: null,
    series: value.series,
  })
  expect(value).toEqual(snapshot)
  const replay = planLocalPlanOccurrenceResult({
    ...value,
    local: plan.local,
    shadows: plan.shadows,
    entries: plan.entries,
    existingOutcome: plan.outcome,
  })
  expect(replay.status).toBe("replayed")
  expect(replay.entries).toEqual(plan.entries)
  expect(replay.outcome).toEqual(plan.outcome)
  expect(() =>
    planLocalPlanOccurrenceResult({
      ...value,
      entries: plan.entries,
      existingOutcome: null,
    })
  ).toThrow()
})

test("ACK rebases only unattempted direct dependents of the same appearance, never parent bases, other slots or historical payloads", () => {
  const value = fixture()
  const direct = dependent(value, 2)
  const transitive = dependent(value, 3, {
    dependency: direct.operation.operationId,
  })
  const attempted = dependent(value, 4, { attempts: 1 })
  const other = dependent(value, 5, {
    occurrenceId: `${value.series.id}:2026-10-12`,
  })
  const historical = dependent(value, 6, { historical: true })
  const parent: OutboxEntry = {
    ...direct,
    sequence: 7,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 3,
      command: { type: "item.delete", itemId: value.series.id },
    },
  }
  const input = {
    ...value,
    entries: [
      ...value.entries,
      direct,
      transitive,
      attempted,
      other,
      historical,
      parent,
    ],
  }
  const plan = planLocalPlanOccurrenceResult(input)
  expect(plan.local).toEqual(value.local)
  expect(plan.entries[1]).toMatchObject({
    operation: {
      operationId: direct.operation.operationId,
      baseRevision: 3,
      command: { expectedOccurrenceRevision: 1 },
    },
    dependencies: direct.dependencies,
    attempts: 0,
  })
  expect(plan.entries.slice(2)).toEqual(input.entries.slice(2))
  expect(input.entries[1]).toEqual(direct)
})

test("a dependency chain can rebase successive appearance revisions without changing its parent revision", () => {
  const value = fixture(),
    first = dependent(value, 2)
  const second = dependent(value, 3, {
    dependency: first.operation.operationId,
  })
  const plan = planLocalPlanOccurrenceResult({
    ...value,
    entries: [...value.entries, first, second],
  })
  const operation = remotePlanOccurrenceOperationSchema.parse(
    plan.entries[1].operation
  )
  const nextResult = {
    ...value.submission.result,
    outcome: {
      ...value.submission.result.outcome,
      operationId: operation.operationId,
      sequence: 6,
      occurrence: {
        ...value.submission.result.outcome.occurrence,
        revision: 2,
        status: "not_started",
        completedAt: null,
      },
    },
  }
  const result = planLocalPlanOccurrenceResult({
    ...value,
    entries: plan.entries.map((entry, i) =>
      i === 1
        ? {
            ...entry,
            state: "sending",
            attempts: 1,
            lease: value.entries[0].lease,
          }
        : entry
    ),
    shadows: plan.shadows,
    submission: { ...value.submission, operation, result: nextResult },
  })
  expect(result.entries[2]).toMatchObject({
    operation: { baseRevision: 3, command: { expectedOccurrenceRevision: 2 } },
  })
  expect(result.entries[2].operation.operationId).toBe(
    second.operation.operationId
  )
})

test("pending appearance or parent content keeps local intent; another slot and settled history do not block projection", () => {
  const value = fixture()
  expect(planRemotePlanOccurrenceProjection(projection(value))).toMatchObject({
    local: value.local,
    pending: true,
  })
  const acknowledged = {
    ...value.entries[0],
    state: "acknowledged",
    lease: null,
  }
  const other = dependent(value, 2, {
    occurrenceId: `${value.series.id}:2026-10-12`,
  })
  expect(
    planRemotePlanOccurrenceProjection(
      projection(value, [acknowledged as OutboxEntry, other])
    )
  ).toMatchObject({ local: shadow(value, 2).record, pending: false })
  const parent: OutboxEntry = {
    ...other,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 3,
      command: { type: "item.delete", itemId: value.series.id },
    },
  }
  expect(
    planRemotePlanOccurrenceProjection(
      projection(value, [acknowledged as OutboxEntry, parent])
    )
  ).toMatchObject({ local: value.local, pending: true })
  const deleted = {
    ...shadow(value, 2),
    record: {
      ...shadow(value, 2).record,
      cancelled: true,
      deletedAt: timestamp,
    },
  }
  expect(
    planRemotePlanOccurrenceProjection({
      ...projection(value, [acknowledged as OutboxEntry]),
      incoming: deleted,
    }).local
  ).toEqual(deleted.record)
})

test("late replay never regresses newer shadow; same revision with different record is rejected, parent observation may be newer", () => {
  const value = fixture(),
    observed = shadow(value, 7)
  const plan = planLocalPlanOccurrenceResult({ ...value, shadows: [observed] })
  expect(plan.local).toEqual(observed.record)
  expect(plan.outcome.base).toEqual(observed.record)
  expect(plan.outcome.result).toEqual(value.submission.result)
  expect(plan.shadows[0]).toEqual(observed)
  expect(() =>
    planRemotePlanOccurrenceProjection({
      ...projection(value),
      shadow: observed,
      incoming: {
        ...observed,
        record: {
          ...observed.record,
          content: { title: "Changed", description: "" },
        },
      },
    })
  ).toThrow("same revision")
  expect(
    planRemotePlanOccurrenceProjection({
      ...projection(value),
      shadow: observed,
      incoming: { ...observed, seriesRevision: 9 },
    }).shadow
  ).toMatchObject({ seriesRevision: 9, record: observed.record })
})

test("conflict, unsupported and rejected results release the owned lease without ACK or losing local work", () => {
  const value = fixture()
  for (const status of [
    "unavailable",
    "unsupported",
    "invalid_command",
    "identity_reuse",
  ] as const) {
    const plan = planLocalPlanOccurrenceResult({
      ...value,
      submission: {
        ...value.submission,
        result: {
          ...value.submission.result,
          outcome: {
            status,
            operationId: value.submission.operation.operationId,
          },
        },
      },
    })
    expect(plan.entries[0].state).toBe(
      status === "unsupported" ? "pending" : "rejected"
    )
    expect(plan.entries[0].lease).toBeNull()
    expect(plan.local).toEqual(value.local)
  }
  const plan = planLocalPlanOccurrenceResult({
    ...value,
    submission: {
      ...value.submission,
      result: {
        ...value.submission.result,
        outcome: {
          status: "conflict",
          operationId: value.submission.operation.operationId,
          series: { ...value.series, revision: 4 },
          current: null,
        },
      },
    },
  })
  expect(plan.entries[0].state).toBe("conflict")
  expect(plan.local).toEqual(value.local)
  expect(plan.shadows).toHaveLength(0)
})

test("incomplete, foreign or duplicate snapshots and lost leases fail before any ACK plan", () => {
  const value = fixture(),
    current = shadow(value, 1)
  for (const input of [
    {
      ...value,
      entries: [
        {
          ...value.entries[0],
          lease: { ...value.entries[0].lease, ownerId: crypto.randomUUID() },
        },
      ],
    },
    { ...value, entries: [...value.entries, value.entries[0]] },
    {
      ...value,
      entries: [{ ...value.entries[0], dependencies: [crypto.randomUUID()] }],
    },
    { ...value, entries: [{ ...value.entries[0], userId: "foreign" }] },
    { ...value, shadows: [current, current] },
    { ...value, shadows: [{ ...current, userId: "foreign" }] },
    { ...value, series: { ...value.series, ownerId: "foreign" } },
  ])
    expect(() => planLocalPlanOccurrenceResult(input)).toThrow()
})
