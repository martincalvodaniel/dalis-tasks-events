import { expect, test } from "bun:test"
import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import {
  availablePlanOccurrenceResolutionChoices,
  planOccurrenceIncidentResolution,
  validatePlanOccurrenceResolutionRecord,
} from "@/lib/sync/plan-occurrence-resolution"
import { projectPlanOccurrenceSyncIncidents } from "@/lib/sync/recurring-incident-snapshot"
import { localPlanOccurrenceOutcomeSchema } from "@/schemas/local-plan-occurrence-sync"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"
import type { PlanOccurrenceResolutionRequest } from "@/types/plan-occurrence-resolution"

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
