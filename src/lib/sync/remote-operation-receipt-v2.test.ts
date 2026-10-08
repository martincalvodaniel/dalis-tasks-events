import { expect, test } from "bun:test"
import {
  decodeRemoteOperationReceipt,
  validateRemoteOperationReceiptV2,
} from "@/lib/sync/remote-operation-receipt-v2"
import { maximumRemoteOperationReceiptBytes } from "@/schemas/remote-operation-receipt-v2"
import { remoteOperationResultV2Schema } from "@/schemas/remote-operation-result-v2"
import type { CalendarItem } from "@/types/calendar-item"
import type { PreferenceEffect } from "@/types/preference-effects"
import type { RemoteOperationReceiptV2 } from "@/types/remote-operation-receipt-v2"
import type { RemoteOperationResult } from "@/types/remote-sync"

const actorUserId = "receipt-test-actor"
const operationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const createdAt = "2026-10-08T00:00:00.000Z"
const fingerprint = "a".repeat(64)
function tag(): PreferenceEffect & { store: "tags" } {
  return {
    store: "tags",
    record: {
      id: crypto.randomUUID(),
      userId: actorUserId,
      name: "A",
      normalizedName: "a",
      color: "#123456",
      position: 0,
      revision: 1,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    },
  }
}
function item(): CalendarItem {
  return {
    id: crypto.randomUUID(),
    ownerId: actorUserId,
    kind: "task",
    title: "Test task",
    description: "",
    scheduledDate: "2026-10-08",
    status: "not_started",
    checklist: [],
    recurrence: null,
    completedAt: null,
    revision: 1,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  }
}
function receipt(): RemoteOperationReceiptV2 & {
  result: { kind: "preference"; outcome: { status: "applied" } }
} {
  return {
    version: 2,
    actorUserId,
    operationId,
    fingerprint,
    createdAt,
    result: {
      kind: "preference",
      outcome: {
        operationId,
        status: "applied",
        effects: {
          version: 1,
          userId: actorUserId,
          operationId,
          sequence: 3,
          effects: [tag()],
        },
      },
    },
  }
}

test("legacy receipt adaptation preserves every result, digest, date and source exactly", () => {
  const results: RemoteOperationResult[] = [
    { operationId, status: "applied", item: item(), sequence: 2 },
    { operationId, status: "conflict", current: item() },
    ...(
      [
        "unavailable",
        "unsupported",
        "invalid_command",
        "identity_reuse",
      ] as const
    ).map((status) => ({ operationId, status })),
  ]
  for (const result of results) {
    const legacy = { actorUserId, operationId, fingerprint, createdAt, result }
    const before = JSON.stringify(legacy)
    const decoded = decodeRemoteOperationReceipt(legacy, actorUserId)
    expect(decoded).toEqual({
      ...legacy,
      version: 2,
      result: { kind: "item", outcome: result },
    })
    expect(validateRemoteOperationReceiptV2(decoded, actorUserId)).toEqual(
      decoded
    )
    decoded.fingerprint = "b".repeat(64)
    if (
      decoded.result.kind === "item" &&
      decoded.result.outcome.status === "applied"
    )
      decoded.result.outcome.item.title = "Changed clone"
    expect(JSON.stringify(legacy)).toBe(before)
  }
  const personal = receipt()
  const before = structuredClone(personal)
  const decoded = decodeRemoteOperationReceipt(personal, actorUserId)
  expect(decoded).toEqual(personal)
  if (
    decoded.result.kind === "preference" &&
    decoded.result.outcome.status === "applied"
  )
    decoded.result.outcome.effects.effects[0].record.userId = "changed-clone"
  expect(personal).toEqual(before)
})

test("receipts bind actor and operation even for outcomes without documents", () => {
  const valid = receipt()
  expect(() => validateRemoteOperationReceiptV2(valid, "other-actor")).toThrow()
  expect(() => validateRemoteOperationReceiptV2(valid, "")).toThrow()
  const conflict = {
    ...valid,
    result: {
      kind: "preference",
      outcome: { operationId, status: "conflict", current: tag() },
    },
  }
  expect(
    validateRemoteOperationReceiptV2(conflict, actorUserId).result.outcome
      .status
  ).toBe("conflict")
  for (const input of [
    { ...valid, operationId: crypto.randomUUID() },
    { ...valid, actorUserId: "other-actor" },
    { ...conflict, actorUserId: "other-actor" },
    { ...valid, fingerprint: "a".repeat(63) },
    { ...valid, createdAt: "invalid-date" },
    { ...valid, version: 3 },
    { ...valid, unexpected: true },
    { ...valid, version: undefined },
  ])
    expect(() => decodeRemoteOperationReceipt(input, actorUserId)).toThrow()
  const error = {
    ...valid,
    result: {
      kind: "preference",
      outcome: { operationId, status: "unsupported" },
    },
  }
  expect(
    validateRemoteOperationReceiptV2(error, actorUserId).result.outcome.status
  ).toBe("unsupported")
  expect(() => validateRemoteOperationReceiptV2(error, "other-actor")).toThrow()
  expect(() =>
    decodeRemoteOperationReceipt(
      {
        actorUserId: "other-actor",
        operationId,
        fingerprint,
        createdAt,
        result: { operationId, status: "unsupported" },
      },
      actorUserId
    )
  ).toThrow()
  expect(() =>
    decodeRemoteOperationReceipt(
      {
        actorUserId,
        operationId,
        fingerprint,
        createdAt,
        result: {
          operationId,
          status: "conflict",
          current: { ...item(), ownerId: "other-actor" },
        },
      },
      actorUserId
    )
  ).toThrow()
})

test("the receipt UTF8 limit also counts metadata around a valid operation result", () => {
  const input = receipt()
  const bytes = (value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value)).byteLength
  const one = tag()
  const empty = structuredClone(input)
  empty.result.outcome.effects.effects = []
  const count = Math.floor(
    (maximumRemoteOperationReceiptBytes - bytes(empty)) / (bytes(one) + 1)
  )
  input.result.outcome.effects.effects = Array.from({ length: count }, tag)
  const last = input.result.outcome.effects.effects.at(-1)
  if (last?.store !== "tags") throw new Error("Expected boundary category")
  while (bytes(input) <= maximumRemoteOperationReceiptBytes) {
    last.record.name += "界"
    last.record.normalizedName = last.record.name.toLowerCase()
  }
  expect(last.record.name.length).toBeLessThanOrEqual(60)
  expect(remoteOperationResultV2Schema.safeParse(input.result).success).toBe(
    true
  )
  expect(JSON.stringify(input).length).toBeLessThan(
    maximumRemoteOperationReceiptBytes
  )
  expect(() => validateRemoteOperationReceiptV2(input, actorUserId)).toThrow()
})
