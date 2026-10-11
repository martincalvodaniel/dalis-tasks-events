import { expect, test } from "bun:test"
import { planRemotePlanOccurrenceOperation } from "@/lib/calendar/remote-plan-occurrence-plan"
import { decodeRemoteOperationReceipt } from "@/lib/sync/remote-operation-receipt-v2"
import { decodeRemoteRecurringOperationReceipt } from "@/lib/sync/remote-recurring-receipt"
import { planSchema } from "@/schemas/plan-item"
import { remoteOperationResultV2Schema } from "@/schemas/remote-operation-result-v2"
import {
  remotePlanOccurrenceChangeSchema,
  remotePlanOccurrenceResultSchema,
  remoteRecurringOperationReceiptSchema,
} from "@/schemas/remote-plan-occurrence-result"
import type { RemotePlanOccurrenceResult } from "@/types/remote-recurring-sync"

const actor = "prepared-recurrence-contract"
const id = "00000000-0000-4000-8000-000000000001"
const operationId = "00000000-0000-4000-8000-000000000002"
const now = "2026-10-11T13:30:00.000Z"
function series() {
  return planSchema.parse({
    kind: "plan",
    variant: "note",
    id,
    ownerId: actor,
    title: "Recurring note",
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
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
}
function occurrence() {
  const plan = planRemotePlanOccurrenceOperation({
    userId: actor,
    timestamp: now,
    series: series(),
    current: null,
    operation: {
      operationId,
      protocolVersion: 1,
      baseRevision: 3,
      command: {
        type: "plan.set-occurrence-status",
        itemId: id,
        occurrenceId: `${id}:2026-10-11`,
        expectedOccurrenceRevision: 0,
        status: "completed",
      },
    },
  })
  if (plan.status !== "changes") throw new Error("Expected prepared appearance")
  return plan.record
}
function applied(): RemotePlanOccurrenceResult & {
  outcome: { status: "applied" }
} {
  return {
    kind: "plan-occurrence" as const,
    userId: actor,
    outcome: {
      operationId,
      status: "applied" as const,
      occurrence: occurrence(),
      seriesRevision: 3,
      sequence: 7,
    },
  }
}
function receipt() {
  return {
    version: 2 as const,
    actorUserId: actor,
    operationId,
    fingerprint: "a".repeat(64),
    result: applied(),
    createdAt: now,
  }
}

test("future appearance evidence keeps parent and own revisions independent while active decoders reject it", () => {
  const source = receipt()
  const before = structuredClone(source)
  expect(decodeRemoteRecurringOperationReceipt(source, actor)).toEqual(source)
  expect(source).toEqual(before)
  expect(source.result.outcome).toMatchObject({
    seriesRevision: 3,
    occurrence: { revision: 1, id: `${id}:2026-10-11`, completedAt: now },
  })
  expect(() => decodeRemoteOperationReceipt(source, actor)).toThrow()
  expect(remoteOperationResultV2Schema.safeParse(source.result).success).toBe(
    false
  )
  for (const changes of [
    { revision: 0 },
    { id: `${id}:2026-10-12` },
    { seriesId: operationId },
    { completedAt: null },
  ]) {
    expect(
      remotePlanOccurrenceResultSchema.safeParse({
        ...applied(),
        outcome: {
          ...applied().outcome,
          occurrence: { ...occurrence(), ...changes },
        },
      }).success
    ).toBe(false)
  }
  expect(
    remotePlanOccurrenceResultSchema.safeParse({
      ...applied(),
      outcome: { ...applied().outcome, seriesRevision: 0 },
    }).success
  ).toBe(false)
})

test("future receipts enforce actor, UUID, fingerprint, metadata and strict envelope version", () => {
  const source = receipt()
  for (const changes of [
    { version: 3 },
    { actorUserId: "foreign-actor" },
    { operationId: id },
    { fingerprint: "not-a-digest" },
    { createdAt: "invalid" },
    { extra: true },
  ]) {
    expect(
      remoteRecurringOperationReceiptSchema.safeParse({ ...source, ...changes })
        .success
    ).toBe(false)
  }
  expect(() =>
    decodeRemoteRecurringOperationReceipt(source, "foreign-actor")
  ).toThrow()
})

test("conflict evidence preserves missing materialization and rejects foreign or unrelated parent data", () => {
  const result = {
    kind: "plan-occurrence" as const,
    userId: actor,
    outcome: {
      operationId,
      status: "conflict" as const,
      series: series(),
      current: occurrence(),
    },
  }
  expect(remotePlanOccurrenceResultSchema.parse(result)).toEqual(result)
  expect(
    remotePlanOccurrenceResultSchema.parse({
      ...result,
      outcome: { ...result.outcome, current: null },
    })
  ).toMatchObject({ outcome: { current: null } })
  expect(
    remotePlanOccurrenceResultSchema.safeParse({
      ...result,
      userId: "foreign-actor",
    }).success
  ).toBe(false)
  expect(
    remotePlanOccurrenceResultSchema.safeParse({
      ...result,
      outcome: { ...result.outcome, series: { ...series(), id: operationId } },
    }).success
  ).toBe(false)
})

test("journal requires committed appearance and positive sequence without changing its original slot", () => {
  const source = {
    version: 2 as const,
    kind: "plan-occurrence" as const,
    recipientUserId: actor,
    operationId,
    sequence: 7,
    seriesRevision: 3,
    occurrence: occurrence(),
  }
  expect(remotePlanOccurrenceChangeSchema.parse(source)).toEqual(source)
  const moved = {
    ...occurrence(),
    schedule: {
      mode: "all_day",
      startDate: "2026-10-15",
      endDateExclusive: "2026-10-16",
    },
  }
  expect(
    remotePlanOccurrenceChangeSchema.parse({ ...source, occurrence: moved })
  ).toMatchObject({
    occurrence: { slotKey: "2026-10-11", schedule: moved.schedule },
  })
  for (const changes of [
    { sequence: 0 },
    { seriesRevision: 0 },
    { version: 5 },
    { extra: true },
  ])
    expect(
      remotePlanOccurrenceChangeSchema.safeParse({ ...source, ...changes })
        .success
    ).toBe(false)
})

test("future receipt reader preserves previous envelopes and adapts legacy without changing fingerprints", () => {
  const source = {
    actorUserId: actor,
    operationId,
    fingerprint: "b".repeat(64),
    createdAt: now,
    result: {
      operationId,
      status: "applied" as const,
      item: series(),
      sequence: 2,
    },
  }
  const before = structuredClone(source)
  const decoded = decodeRemoteRecurringOperationReceipt(source, actor)
  expect(decoded).toEqual({
    ...source,
    version: 2 as const,
    result: { kind: "item", outcome: source.result },
  })
  expect(source).toEqual(before)
  expect(decodeRemoteRecurringOperationReceipt(decoded, actor)).toEqual(decoded)
  for (const status of [
    "unsupported",
    "unavailable",
    "invalid_command",
    "identity_reuse",
  ] as const)
    expect(
      remotePlanOccurrenceResultSchema.parse({
        kind: "plan-occurrence" as const,
        userId: actor,
        outcome: { operationId, status },
      })
    ).toMatchObject({ outcome: { status } })
})
