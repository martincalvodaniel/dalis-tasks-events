import { expect, test } from "bun:test"
import { planRemotePlanOccurrenceOperation } from "@/lib/calendar/remote-plan-occurrence-plan"
import { syncOperationFingerprint } from "@/lib/sync/operation-fingerprint"
import { validateRemotePushResultV2 } from "@/lib/sync/remote-push-v2"
import {
  remoteRecurringOperationKind,
  validateRemoteRecurringOperationResult,
  validateRemoteRecurringPushResult,
} from "@/lib/sync/remote-recurring-push"
import { planSchema } from "@/schemas/plan-item"
import { maximumRemotePushResultV2Bytes } from "@/schemas/remote-push-v2"
import { remoteRecurringPushResultSchema } from "@/schemas/remote-recurring-push"
import type { RemoteRecurringOperationResult } from "@/types/remote-recurring-sync"
import type { SyncOperation } from "@/types/sync"

const actor = "recurring-push-fixture"
const timestamp = "2026-10-11T09:00:00.000Z"
function fixture() {
  const series = planSchema.parse({
    kind: "plan",
    variant: "note",
    id: crypto.randomUUID(),
    ownerId: actor,
    title: "Own series",
    description: "",
    status: "not_started",
    checklist: [],
    completedAt: null,
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
  const operations: SyncOperation[] = [
    {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 2,
      command: { type: "item.delete", itemId: series.id },
    },
    {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 3,
      command: {
        type: "plan.set-occurrence-status",
        itemId: series.id,
        occurrenceId: `${series.id}:2026-10-11`,
        expectedOccurrenceRevision: 0,
        status: "completed",
      },
    },
    {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 0,
      command: {
        type: "task.move",
        itemId: series.id,
        occurrenceId: `${series.id}:2026-10-11`,
        scope: "day",
        date: "2026-10-11",
        tagId: null,
        beforeId: null,
        afterId: null,
      },
    },
  ]
  const planned = planRemotePlanOccurrenceOperation({
    userId: actor,
    timestamp,
    series,
    current: null,
    operation: operations[1],
  })
  if (planned.status !== "changes")
    throw new Error("Expected appearance fixture")
  const results: RemoteRecurringOperationResult[] = [
    {
      kind: "item",
      outcome: {
        operationId: operations[0].operationId,
        status: "conflict",
        current: series,
      },
    },
    {
      kind: "plan-occurrence",
      userId: actor,
      outcome: {
        operationId: operations[1].operationId,
        status: "applied",
        occurrence: planned.record,
        seriesRevision: 3,
        sequence: 1,
      },
    },
    {
      kind: "preference",
      outcome: {
        operationId: operations[2].operationId,
        status: "applied",
        effects: {
          version: 1,
          userId: actor,
          operationId: operations[2].operationId,
          sequence: 2,
          effects: [
            {
              store: "taskPlacements",
              record: {
                userId: actor,
                occurrenceId: `${series.id}:2026-10-11`,
                scope: "day",
                date: "2026-10-11",
                tagId: null,
                position: 0,
                revision: 1,
                createdAt: timestamp,
                updatedAt: timestamp,
                deletedAt: null,
              },
            },
          ],
        },
      },
    },
  ]
  return {
    series,
    request: {
      transportVersion: 2 as const,
      expectedUserId: actor,
      operations,
    },
    response: {
      transportVersion: 2 as const,
      status: "complete" as const,
      results,
    },
  }
}

test("future mixed push preserves envelopes, ordered intentions and independent appearance revisions", () => {
  const { request, response } = fixture(),
    before = structuredClone({ request, response })
  expect(validateRemoteRecurringPushResult(response, actor, request)).toEqual(
    response
  )
  expect(() => validateRemotePushResultV2(response, actor, request)).toThrow()
  for (const count of [0, 1, 2]) {
    const partial = {
      transportVersion: 2 as const,
      status: "retry_later" as const,
      results: response.results.slice(0, count),
      failedOperationId: request.operations[count].operationId,
    }
    expect(validateRemoteRecurringPushResult(partial, actor, request)).toEqual(
      partial
    )
  }
  for (const status of [
    "unauthorized",
    "invalid_batch",
    "account_changed",
    "update_required",
  ] as const)
    expect(
      validateRemoteRecurringPushResult(
        { transportVersion: 2, status },
        actor,
        request
      )
    ).toEqual({ transportVersion: 2, status })
  expect({ request, response }).toEqual(before)
  expect(request.operations.map(syncOperationFingerprint)).toEqual(
    before.request.operations.map(syncOperationFingerprint)
  )
})

test("future push rejects skipped, duplicate, reordered and overcomplete result prefixes", () => {
  const { request, response } = fixture()
  for (const invalid of [
    { ...response, results: response.results.slice(0, 2) },
    {
      ...response,
      results: [response.results[1], response.results[0], response.results[2]],
    },
    {
      ...response,
      results: [response.results[0], response.results[0], response.results[2]],
    },
    { ...response, results: [...response.results, response.results[1]] },
    {
      transportVersion: 2,
      status: "retry_later",
      results: [],
      failedOperationId: request.operations[1].operationId,
    },
    {
      transportVersion: 2,
      status: "retry_later",
      results: response.results,
      failedOperationId: request.operations[0].operationId,
    },
    { ...response, transportVersion: 5 },
    { ...response, extra: true },
  ])
    expect(() =>
      validateRemoteRecurringPushResult(invalid, actor, request)
    ).toThrow()
})

test("appearance correspondence rejects foreign actors, slots, revisions and command effects", () => {
  const { request, response, series } = fixture(),
    operation = request.operations[1],
    result = response.results[1]
  if (result.kind !== "plan-occurrence" || result.outcome.status !== "applied")
    throw new Error("Expected applied appearance")
  for (const invalid of [
    { ...result, userId: "foreign" },
    {
      ...result,
      outcome: { ...result.outcome, operationId: crypto.randomUUID() },
    },
    { ...result, outcome: { ...result.outcome, seriesRevision: 4 } },
    {
      ...result,
      outcome: {
        ...result.outcome,
        occurrence: { ...result.outcome.occurrence, revision: 2 },
      },
    },
    {
      ...result,
      outcome: {
        ...result.outcome,
        occurrence: {
          ...result.outcome.occurrence,
          status: "in_progress",
          completedAt: null,
        },
      },
    },
    {
      ...result,
      outcome: {
        ...result.outcome,
        occurrence: {
          ...result.outcome.occurrence,
          id: `${series.id}:2026-10-12`,
          slotKey: "2026-10-12",
        },
      },
    },
    {
      kind: "item",
      outcome: { operationId: operation.operationId, status: "unsupported" },
    },
    {
      kind: "plan-occurrence" as const,
      userId: actor,
      outcome: {
        operationId: operation.operationId,
        status: "conflict",
        series: { ...series, id: crypto.randomUUID() },
        current: null,
      },
    },
  ])
    expect(() =>
      validateRemoteRecurringOperationResult(invalid, actor, operation)
    ).toThrow()
  expect(() =>
    validateRemoteRecurringPushResult(response, "foreign", request)
  ).toThrow()
  const placement = response.results[2]
  if (placement.kind !== "preference" || placement.outcome.status !== "applied")
    throw new Error("Expected placement")
  const changed = structuredClone(placement)
  if (
    changed.outcome.status !== "applied" ||
    changed.outcome.effects.effects[0].store !== "taskPlacements"
  )
    throw new Error("Expected placement")
  changed.outcome.effects.effects[0].record.occurrenceId = `${series.id}:2026-10-12`
  expect(() =>
    validateRemoteRecurringOperationResult(
      changed,
      actor,
      request.operations[2]
    )
  ).toThrow()
})

test("historical unsupported appearance intentions retain missing CAS and exact payload", () => {
  const { request, response } = fixture()
  const operation = structuredClone(request.operations[1])
  if (operation.command.type !== "plan.set-occurrence-status")
    throw new Error("Expected status command")
  delete operation.command.expectedOccurrenceRevision
  const before = structuredClone(operation)
  for (const status of [
    "unsupported",
    "unavailable",
    "invalid_command",
    "identity_reuse",
  ] as const) {
    const result = {
      kind: "plan-occurrence" as const,
      userId: actor,
      outcome: { operationId: operation.operationId, status },
    }
    expect(
      validateRemoteRecurringOperationResult(result, actor, operation)
    ).toEqual(result)
  }
  expect(() =>
    validateRemoteRecurringOperationResult(
      response.results[1],
      actor,
      operation
    )
  ).toThrow()
  expect(operation).toEqual(before)
  for (const type of [
    "plan.set-occurrence-status",
    "plan.set-occurrence-checklist-entry",
    "plan.update-occurrence",
    "plan.cancel-occurrence",
  ])
    expect(
      remoteRecurringOperationKind({
        ...operation.command,
        type,
      } as SyncOperation["command"])
    ).toBe("plan-occurrence")
})

test("future response byte limit rejects oversized UTF8 without truncating individual outcomes", () => {
  const { series } = fixture()
  const large = {
    ...series,
    description: "ñ".repeat(10000),
    checklist: Array.from({ length: 100 }, () => ({
      id: crypto.randomUUID(),
      text: "ñ".repeat(500),
      completed: false,
    })),
  }
  const results: RemoteRecurringOperationResult[] = Array.from(
    { length: 20 },
    () => ({
      kind: "item",
      outcome: {
        operationId: crypto.randomUUID(),
        status: "conflict",
        current: large,
      },
    })
  )
  const response = { transportVersion: 2, status: "complete", results }
  expect(JSON.stringify(response).length).toBeLessThan(
    maximumRemotePushResultV2Bytes
  )
  expect(
    new TextEncoder().encode(JSON.stringify(response)).byteLength
  ).toBeGreaterThan(maximumRemotePushResultV2Bytes)
  expect(() => remoteRecurringPushResultSchema.parse(response)).toThrow()
  expect(
    remoteRecurringPushResultSchema.safeParse({
      ...response,
      results: results.slice(0, 10),
    }).success
  ).toBe(true)
})
