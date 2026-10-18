import { expect, test } from "bun:test"
import { validateLocalRecurringBackup } from "@/lib/backup/local-backup"
import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import { planRemotePlanOccurrenceOperation } from "@/lib/calendar/remote-plan-occurrence-plan"
import {
  availablePlanOccurrenceResolutionChoices,
  planOccurrenceIncidentResolution,
  planOccurrenceRetryOperationCount,
  validatePlanOccurrenceResolutionRecord,
} from "@/lib/sync/plan-occurrence-resolution"
import { planLocalPlanOccurrenceResult } from "@/lib/sync/plan-occurrence-result-plan"
import { projectPlanOccurrenceSyncIncidents } from "@/lib/sync/recurring-incident-snapshot"
import { localBackupMetadataV2Schema } from "@/schemas/local-backup"
import { localPlanOccurrenceOutcomeSchema } from "@/schemas/local-plan-occurrence-sync"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"
import { settingsResolutionRecordSchema } from "@/schemas/settings-resolution"
import type { OutboxEntry } from "@/types/local-sync"
import type { PlanOccurrence } from "@/types/plan-occurrence"
import type { PlanOccurrenceResolutionRequest } from "@/types/plan-occurrence-resolution"
import type { RemoteRecurringShadow } from "@/types/remote-recurring-sync"

const timestamp = "2026-10-11T13:00:00.000Z"
function fixture() {
  const userId = "recurring-incident-owner",
    id = crypto.randomUUID()
  const series = planSchema.parse({
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
    revision: 3,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  })
  const entry = outboxEntrySchema.parse({
    userId,
    entityKey: `item:${id}`,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 3,
      command: {
        type: "plan.set-occurrence-status",
        itemId: id,
        occurrenceId: `${id}:2026-10-11`,
        expectedOccurrenceRevision: 0,
        status: "in_progress",
      },
    },
    state: "conflict",
    attempts: 1,
    lease: null,
    sequence: 1,
    dependencies: [],
    createdAt: timestamp,
  })
  const local = applyPlanOccurrenceCommand(
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
  )
  const remote = {
    ...local,
    revision: 2,
    status: "completed" as const,
    completedAt: timestamp,
  }
  const outcome = localPlanOccurrenceOutcomeSchema.parse({
    version: 2,
    kind: "plan-occurrence",
    key: `operation-outcome:${entry.operation.operationId}`,
    operation: entry.operation,
    result: {
      kind: "plan-occurrence",
      userId,
      outcome: {
        status: "conflict",
        operationId: entry.operation.operationId,
        series,
        current: remote,
      },
    },
    local,
    base: null,
    series,
  })
  return {
    userId,
    series,
    entry,
    local,
    remote,
    outcome,
    input: {
      userId,
      items: [series],
      occurrences: [local],
      entries: [entry],
      shadows: [] as unknown[],
      outcomes: [outcome] as unknown[],
    },
  }
}
function comparison() {
  const value = fixture()
  const child = outboxEntrySchema.parse({
    ...value.entry,
    state: "pending",
    attempts: 0,
    sequence: 2,
    dependencies: [value.entry.operation.operationId],
    operation: { ...value.entry.operation, operationId: crypto.randomUUID() },
  })
  const input = { ...value.input, entries: [value.entry, child] }
  const current = projectPlanOccurrenceSyncIncidents(input)[0]
  const request: PlanOccurrenceResolutionRequest = {
    userId: value.userId,
    resolutionId: crypto.randomUUID(),
    operationId: null,
    choice: "adopt_remote",
    createdAt: timestamp,
    expected: current,
  }
  return { value, input, current, request }
}

test("adoption preserves the remote slot and original evidence without an operation or ACK", () => {
  const { current, request } = comparison(),
    before = structuredClone(current)
  if (!current.local || !current.remote)
    throw new Error("Appearance fixture missing")
  const record = planOccurrenceIncidentResolution(request, current)
  expect(availablePlanOccurrenceResolutionChoices(current)).toEqual([
    "adopt_remote",
    "retry_local",
  ])
  expect(record.local).toEqual(current.remote)
  expect(record.local.seriesId).toBe(current.series.id)
  expect(record.local.id).toBe(current.local.id)
  expect(record.replacement).toBeNull()
  expect(record.operationId).toBeNull()
  expect(record.supersededOperationIds).toEqual(
    current.intentions.map((entry) => entry.operation.operationId)
  )
  expect(current).toEqual(before)
  expect(
    validatePlanOccurrenceResolutionRecord(record, request.userId)
  ).toEqual(record)
})
test("all parent variants retain cancellation and tombstone instead of reviving the slot", () => {
  for (const variant of ["task", "event", "appointment", "note"] as const) {
    const { value, input, request } = comparison()
    const series = { ...value.series, variant },
      remote = { ...value.remote, cancelled: true, deletedAt: timestamp }
    const outcome = {
      ...value.outcome,
      series,
      result: {
        ...value.outcome.result,
        outcome: {
          status: "conflict",
          operationId: value.entry.operation.operationId,
          series,
          current: remote,
        },
      },
    }
    const current = projectPlanOccurrenceSyncIncidents({
      ...input,
      items: [series],
      outcomes: [outcome],
    })[0]
    const record = planOccurrenceIncidentResolution(
      { ...request, expected: current },
      current
    )
    expect(record.local).toEqual(remote)
    expect(record.local.cancelled).toBe(true)
    expect(record.local.deletedAt).toBe(timestamp)
  }
})
test("a changed draft, parent or queue invalidates the frozen choice", () => {
  const { current, request } = comparison()
  for (const change of [
    {
      ...current,
      local: current.local
        ? {
            ...current.local,
            content: { title: "Later draft", description: "" },
          }
        : null,
    },
    { ...current, series: { ...current.series, title: "Later parent" } },
    { ...current, intentions: current.intentions.slice(0, 1) },
  ])
    expect(() => planOccurrenceIncidentResolution(request, change)).toThrow(
      "changed"
    )
})
test("foreign account and another slot never become adoption permission", () => {
  const { current, request } = comparison()
  expect(() =>
    planOccurrenceIncidentResolution(
      { ...request, userId: "another-account" },
      current
    )
  ).toThrow()
  expect(
    availablePlanOccurrenceResolutionChoices({
      ...current,
      series: { ...current.series, ownerId: "another-account" },
    })
  ).toEqual([])
  const other = {
    ...current.remote,
    id: `${current.series.id}:2026-10-12`,
    slotKey: "2026-10-12",
  }
  expect(
    availablePlanOccurrenceResolutionChoices({ ...current, remote: other })
  ).toEqual([])
})
test("other slots, parent changes and historical missing CAS remain blocked", () => {
  const { input, current } = comparison()
  const child = current.intentions[1]
  for (const command of [
    {
      ...child.operation.command,
      occurrenceId: `${current.series.id}:2026-10-12`,
    },
    { type: "item.delete", itemId: current.series.id },
    {
      type: "plan.set-occurrence-status",
      itemId: current.series.id,
      occurrenceId: current.remote?.id,
      status: "in_progress",
    },
  ]) {
    const next = outboxEntrySchema.parse({
      ...child,
      operation: { ...child.operation, command },
    })
    const incident = projectPlanOccurrenceSyncIncidents({
      ...input,
      entries: [current.entry, next],
    })[0]
    expect(availablePlanOccurrenceResolutionChoices(incident)).toEqual([])
  }
})
test("unknown remote, rejected result, absent recurrence and parent deletion offer no unsafe choice", () => {
  const { current } = comparison()
  for (const candidate of [
    { ...current, remote: null },
    {
      ...current,
      remote: current.remote ? { ...current.remote, revision: 0 } : null,
    },
    { ...current, reason: "unavailable" },
    { ...current, series: { ...current.series, recurrence: null } },
    { ...current, series: { ...current.series, deletedAt: timestamp } },
    { ...current, blockedByRelatedIntentions: true },
  ])
    expect(availablePlanOccurrenceResolutionChoices(candidate)).toEqual([])
})
test("sending and uncertain attempted children cannot be superseded", () => {
  const { current } = comparison(),
    child = current.intentions[1]
  for (const entry of [
    { ...child, attempts: 1 },
    {
      ...child,
      state: "sending",
      attempts: 1,
      lease: { ownerId: crypto.randomUUID(), expiresAt: timestamp },
    },
  ])
    expect(
      availablePlanOccurrenceResolutionChoices({
        ...current,
        intentions: [current.entry, entry],
      })
    ).toEqual([])
})
test("late remote observation can be newer than the result while optimistic local revision is not an ancestor", () => {
  const { current, request } = comparison()
  if (!current.remote || !current.local)
    throw new Error("Appearance fixture missing")
  const remote = { ...current.remote, revision: 7, cancelled: true }
  const next = {
    ...current,
    remote,
    shadowAtOutcome: remote,
    local: { ...current.local, revision: 99 },
    outcome: { ...current.outcome, base: remote },
  }
  expect(
    planOccurrenceIncidentResolution({ ...request, expected: next }, next).local
  ).toEqual(remote)
  expect(
    availablePlanOccurrenceResolutionChoices({
      ...next,
      remote: current.remote,
    })
  ).toEqual([])
  expect(
    availablePlanOccurrenceResolutionChoices({
      ...current,
      remote: { ...current.remote, cancelled: true },
    })
  ).toEqual([])
  expect(
    availablePlanOccurrenceResolutionChoices({
      ...current,
      series: { ...current.series, revision: 2 },
    })
  ).toEqual([])
})
test("frozen evidence, decision identity and durable projection must agree exactly", () => {
  const { current, request } = comparison()
  expect(
    availablePlanOccurrenceResolutionChoices({
      ...current,
      seriesAtOutcome: null,
    })
  ).toEqual([])
  expect(
    availablePlanOccurrenceResolutionChoices({
      ...current,
      localAtOutcome: null,
    })
  ).toEqual([])
  expect(() =>
    planOccurrenceIncidentResolution(
      { ...request, resolutionId: current.entry.operation.operationId },
      current
    )
  ).toThrow()
  const record = planOccurrenceIncidentResolution(request, current)
  expect(() =>
    validatePlanOccurrenceResolutionRecord(
      { ...record, local: current.local },
      request.userId
    )
  ).toThrow()
  expect(() =>
    validatePlanOccurrenceResolutionRecord(
      { ...record, supersededOperationIds: [record.supersededOperationIds[0]] },
      request.userId
    )
  ).toThrow()
  expect(() =>
    validatePlanOccurrenceResolutionRecord(record, "foreign")
  ).toThrow()
})

test("portable three retains appearance decisions and rejects contradictory or missing evidence", () => {
  const { current, request, input } = comparison()
  const record = planOccurrenceIncidentResolution(request, current)
  const backup = {
    format: "dalis-local-backup",
    version: 3,
    protocolVersion: 1,
    databaseVersion: 2,
    userId: request.userId,
    exportedAt: request.createdAt,
    stores: {
      items: input.items,
      occurrences: [record.local],
      tags: [],
      itemViews: [],
      taskPlacements: [],
      settings: [],
      memberships: [],
      invitations: [],
      outbox: input.entries.map((entry) => ({
        ...entry,
        state: "superseded" as const,
      })),
      remoteShadows: [],
      syncMetadata: [
        { key: "outbox-sequence", value: 2 },
        ...input.outcomes,
        record,
      ],
    },
  }
  expect(
    validateLocalRecurringBackup(backup, request.userId).stores.occurrences
  ).toEqual([record.local])
  expect(localBackupMetadataV2Schema.safeParse(record).success).toBe(false)
  expect(settingsResolutionRecordSchema.safeParse(record).success).toBe(false)
  expect(() =>
    validateLocalRecurringBackup({ ...backup, version: 2 }, request.userId)
  ).toThrow()
  const corrupt = structuredClone(backup)
  corrupt.stores.syncMetadata[corrupt.stores.syncMetadata.length - 1] = {
    ...record,
    local: { ...record.local, cancelled: !record.local.cancelled },
  }
  expect(() => validateLocalRecurringBackup(corrupt, request.userId)).toThrow()
  expect(() =>
    validateLocalRecurringBackup(
      {
        ...backup,
        stores: {
          ...backup.stores,
          syncMetadata: [{ key: "outbox-sequence", value: 2 }, record],
        },
      },
      request.userId
    )
  ).toThrow()
})

function retryRequest(
  current: PlanOccurrenceResolutionRequest["expected"]
): PlanOccurrenceResolutionRequest {
  const count = planOccurrenceRetryOperationCount(current)
  return {
    userId: current.entry.userId,
    resolutionId: crypto.randomUUID(),
    operationId: crypto.randomUUID(),
    dependentOperationIds: Array.from({ length: count - 1 }, () =>
      crypto.randomUUID()
    ),
    choice: "retry_local",
    createdAt: timestamp,
    expected: current,
  }
}
function retryComparison() {
  const { current } = comparison()
  if (!current.local || !current.remote)
    throw new Error("Appearance retry fixture missing")
  const stepId = crypto.randomUUID()
  const remote = {
    ...current.remote,
    status: "not_started" as const,
    completedAt: null,
    checklist: [{ id: stepId, text: "Old step", completed: false }],
  }
  return {
    ...current,
    remote,
    outcome: {
      ...current.outcome,
      result: {
        ...current.outcome.result,
        outcome: {
          status: "conflict" as const,
          operationId: current.entry.operation.operationId,
          series: current.series,
          current: remote,
        },
      },
    },
    local: {
      ...current.local,
      content: {
        title: "Full local title",
        description: "Full local description",
      },
      schedule: {
        mode: "all_day" as const,
        startDate: "2026-10-12",
        endDateExclusive: "2026-10-14",
      },
      status: "completed" as const,
      completedAt: timestamp,
      checklist: [{ id: stepId, text: "Changed local step", completed: true }],
    },
  }
}

test("appearance retry builds the whole chosen exception as a bounded chain of existing commands", () => {
  const current = retryComparison(),
    request = retryRequest(current),
    record = planOccurrenceIncidentResolution(request, current)
  if (!record.replacement) throw new Error("Retry replacement missing")
  const operations = [
    record.replacement,
    ...(record.dependentReplacements ?? []),
  ]
  expect(operations.map((value) => value.command.type)).toEqual([
    "plan.update-occurrence",
    "plan.set-occurrence-status",
    "plan.set-occurrence-checklist-entry",
  ])
  expect(
    operations.map((value) => value.command.expectedOccurrenceRevision)
  ).toEqual([2, 3, 4])
  expect(
    operations.every((value) => value.baseRevision === current.series.revision)
  ).toBe(true)
  expect(record.local).toMatchObject({
    content: current.local.content,
    schedule: current.local.schedule,
    status: current.local.status,
    checklist: current.local.checklist,
    revision: current.remote.revision,
  })
  expect(
    validatePlanOccurrenceResolutionRecord(record, request.userId)
  ).toEqual(record)
})
test("remote planning and direct ACKs preserve predicted replacement payloads and reach exact final projection", () => {
  const current = retryComparison(),
    request = retryRequest(current),
    record = planOccurrenceIncidentResolution(request, current)
  if (!record.replacement) throw new Error("Retry replacement missing")
  const operations = [
      record.replacement,
      ...(record.dependentReplacements ?? []),
    ],
    original = structuredClone(operations),
    senderId = crypto.randomUUID()
  let entries: OutboxEntry[] = [
    ...current.intentions.map((entry) => ({
      ...entry,
      state: "superseded" as const,
    })),
    ...operations.map((operation, index) =>
      outboxEntrySchema.parse({
        userId: request.userId,
        entityKey: current.entry.entityKey,
        operation,
        sequence: current.intentions.length + index + 1,
        dependencies: index ? [operations[index - 1].operationId] : [],
        state: "pending",
        attempts: 0,
        lease: null,
        createdAt: timestamp,
      })
    ),
  ]
  let shadows: RemoteRecurringShadow[] = [],
    local: PlanOccurrence | null = record.local,
    committed: PlanOccurrence = current.remote
  for (let index = 0; index < operations.length; index++) {
    const operation = operations[index]
    const planned = planRemotePlanOccurrenceOperation({
      userId: request.userId,
      timestamp,
      operation,
      series: current.series,
      current: committed,
    })
    if (planned.status !== "changes")
      throw new Error("Predicted retry CAS failed")
    committed = planned.record
    entries = entries.map((entry) =>
      entry.operation.operationId === operation.operationId
        ? {
            ...entry,
            state: "sending",
            attempts: 1,
            lease: { ownerId: senderId, expiresAt: timestamp },
          }
        : entry
    )
    const result = planLocalPlanOccurrenceResult({
      userId: request.userId,
      series: current.series,
      local,
      entries,
      shadows,
      existingOutcome: null,
      submission: {
        operation,
        senderId,
        result: {
          kind: "plan-occurrence",
          userId: request.userId,
          outcome: {
            status: "applied",
            operationId: operation.operationId,
            occurrence: committed,
            seriesRevision: current.series.revision,
            sequence: index + 1,
          },
        },
      },
    })
    entries = result.entries
    shadows = result.shadows
    local = result.local
  }
  expect(
    entries
      .filter((entry) =>
        operations.some(
          (operation) => operation.operationId === entry.operation.operationId
        )
      )
      .map((entry) => entry.operation)
  ).toEqual(original)
  expect(local).toEqual(committed)
  expect(committed).toMatchObject({
    content: current.local.content,
    schedule: current.local.schedule,
    status: current.local.status,
    checklist: current.local.checklist,
    revision: current.remote.revision + operations.length,
  })
})
test("maximum checklist plus progress and cancellation produces exactly103 safe operations", () => {
  const current = retryComparison()
  const steps = Array.from({ length: 100 }, (_, index) => ({
    id: crypto.randomUUID(),
    text: `Step ${index}`,
    completed: false,
  }))
  const remote = { ...current.remote, checklist: steps }
  const next = {
    ...current,
    remote,
    outcome: {
      ...current.outcome,
      result: {
        ...current.outcome.result,
        outcome: {
          status: "conflict" as const,
          operationId: current.entry.operation.operationId,
          series: current.series,
          current: remote,
        },
      },
    },
    local: {
      ...current.local,
      cancelled: true,
      checklist: steps.map((step) => ({ ...step, completed: true })),
    },
  }
  expect(planOccurrenceRetryOperationCount(next)).toBe(103)
  const record = planOccurrenceIncidentResolution(retryRequest(next), next)
  expect(record.dependentReplacements).toHaveLength(102)
  expect(record.dependentReplacements?.at(-1)?.command.type).toBe(
    "plan.cancel-occurrence"
  )
  expect(record.local.cancelled).toBe(true)
  expect(record.local.checklist.every((step) => step.completed)).toBe(true)
})
test("retry identity count, duplicate IDs and revision overflow are rejected before effects", () => {
  const current = retryComparison(),
    request = retryRequest(current)
  for (const changed of [
    { ...request, dependentOperationIds: [] },
    {
      ...request,
      dependentOperationIds: [request.operationId, request.operationId],
    },
    { ...request, operationId: current.entry.operation.operationId },
    { ...request, operationId: request.resolutionId },
  ])
    expect(() => planOccurrenceIncidentResolution(changed, current)).toThrow()
  const remote = { ...current.remote, revision: Number.MAX_SAFE_INTEGER },
    next = {
      ...current,
      remote,
      outcome: {
        ...current.outcome,
        result: {
          ...current.outcome.result,
          outcome: {
            status: "conflict" as const,
            operationId: current.entry.operation.operationId,
            series: current.series,
            current: remote,
          },
        },
      },
    }
  expect(() =>
    planOccurrenceIncidentResolution(retryRequest(next), next)
  ).toThrow("revision range")
})
test("cancelled remote and missing or deleted local draft stay adoption-only", () => {
  const current = retryComparison()
  for (const next of [
    { ...current, local: null },
    { ...current, local: { ...current.local, deletedAt: timestamp } },
    { ...current, remote: { ...current.remote, cancelled: true } },
    { ...current, remote: { ...current.remote, deletedAt: timestamp } },
  ]) {
    if (next.remote)
      next.outcome = {
        ...next.outcome,
        result: {
          ...next.outcome.result,
          outcome: {
            status: "conflict",
            operationId: next.entry.operation.operationId,
            series: next.series,
            current: next.remote,
          },
        },
      }
    expect(availablePlanOccurrenceResolutionChoices(next)).toEqual([
      "adopt_remote",
    ])
    expect(() => planOccurrenceRetryOperationCount(next)).toThrow()
  }
})
