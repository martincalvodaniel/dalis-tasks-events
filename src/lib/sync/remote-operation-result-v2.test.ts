import { expect, test } from "bun:test"
import {
  decodeRemoteOperationResult,
  validateRemoteOperationResultV2,
} from "@/lib/sync/remote-operation-result-v2"
import { remotePreferenceEffectsSchema } from "@/schemas/preference-effects"
import {
  maximumRemoteOperationResultBytes,
  remoteOperationResultV2Schema,
} from "@/schemas/remote-operation-result-v2"
import type { CalendarItem } from "@/types/calendar-item"
import type { PreferenceEffect } from "@/types/preference-effects"
import type { RemoteOperationResult } from "@/types/remote-sync"

const userId = "result-schema-test"
const operationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const timestamp = "2026-10-08T00:00:00.000Z"
const metadata = {
  revision: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
}
function item(): CalendarItem {
  return {
    ...metadata,
    id: crypto.randomUUID(),
    ownerId: userId,
    kind: "task",
    title: "Test task",
    description: "",
    scheduledDate: "2026-10-08",
    recurrence: null,
    status: "not_started",
    checklist: [],
    completedAt: null,
  }
}
function effect(): PreferenceEffect & { store: "tags" } {
  return {
    store: "tags",
    record: {
      ...metadata,
      id: crypto.randomUUID(),
      userId,
      name: "A",
      normalizedName: "a",
      color: "#123456",
      position: 0,
    },
  }
}
function applied() {
  return {
    kind: "preference" as const,
    outcome: {
      operationId,
      status: "applied" as const,
      effects: {
        version: 1 as const,
        userId,
        operationId,
        sequence: 5,
        effects: [effect()],
      },
    },
  }
}
function bytes(input: unknown) {
  return new TextEncoder().encode(JSON.stringify(input)).byteLength
}

test("versioned outcomes and legacy item history preserve all statuses and independent data", () => {
  const outcomes: RemoteOperationResult[] = [
    { operationId, status: "applied", item: item(), sequence: 4 },
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
  for (const outcome of outcomes) {
    const original = structuredClone(outcome)
    const expected = { kind: "item" as const, outcome }
    expect(decodeRemoteOperationResult(outcome, userId)).toEqual(expected)
    expect(validateRemoteOperationResultV2(expected, userId)).toEqual(expected)
    expect(outcome).toEqual(original)
    const decoded = decodeRemoteOperationResult(outcome, userId)
    if (decoded.kind === "item" && decoded.outcome.status === "applied")
      decoded.outcome.item.title = "Changed clone"
    expect(outcome).toEqual(original)
  }
  const personal = applied()
  const before = structuredClone(personal)
  const decoded = decodeRemoteOperationResult(personal, userId)
  expect(decoded).toEqual(personal)
  if (decoded.kind === "preference" && decoded.outcome.status === "applied")
    decoded.outcome.effects.effects[0].record.userId = "changed-clone"
  expect(personal).toEqual(before)
  for (const status of [
    "unavailable",
    "unsupported",
    "invalid_command",
    "identity_reuse",
  ] as const)
    expect(
      validateRemoteOperationResultV2(
        {
          kind: "preference",
          outcome: { operationId, status },
        },
        userId
      )
    ).toEqual({
      kind: "preference",
      outcome: { operationId, status },
    })
})

test("personal conflict preserves a single tombstone without granting a sequence", () => {
  const current = effect()
  current.record.deletedAt = timestamp
  const input = {
    kind: "preference" as const,
    outcome: { operationId, status: "conflict" as const, current },
  }
  expect(validateRemoteOperationResultV2(input, userId)).toEqual(input)
  expect(() =>
    validateRemoteOperationResultV2(
      {
        ...input,
        outcome: { ...input.outcome, sequence: 1 },
      },
      userId
    )
  ).toThrow()
  expect(() =>
    validateRemoteOperationResultV2(
      {
        ...input,
        outcome: {
          ...input.outcome,
          current: {
            ...current,
            record: { ...current.record, revision: 0 },
          },
        },
      },
      userId
    )
  ).toThrow()
})

test("ownership, identity, unknown envelopes and malformed history fail closed", () => {
  const personal = applied()
  expect(() =>
    validateRemoteOperationResultV2(personal, "other-user")
  ).toThrow()
  expect(() =>
    decodeRemoteOperationResult(
      {
        operationId,
        status: "conflict",
        current: item(),
      },
      "other-user"
    )
  ).toThrow()
  expect(() =>
    validateRemoteOperationResultV2(
      {
        kind: "item",
        outcome: { operationId, status: "applied", item: item(), sequence: 1 },
      },
      "other-user"
    )
  ).toThrow()
  expect(() =>
    validateRemoteOperationResultV2(
      {
        kind: "preference",
        outcome: { operationId, status: "conflict", current: effect() },
      },
      "other-user"
    )
  ).toThrow()
  expect(() => validateRemoteOperationResultV2(personal, "")).toThrow()
  expect(() =>
    validateRemoteOperationResultV2(
      {
        ...personal,
        outcome: { ...personal.outcome, operationId: crypto.randomUUID() },
      },
      userId
    )
  ).toThrow()
  const foreign = structuredClone(personal)
  foreign.outcome.effects.effects[0].record.userId = "another-actor"
  expect(() => validateRemoteOperationResultV2(foreign, userId)).toThrow()
  for (const input of [
    { ...personal, version: 3 },
    { ...personal, kind: "future" },
    { ...personal, operationId },
    { ...personal, outcome: { ...personal.outcome, status: "changes" } },
    {
      ...personal,
      outcome: { operationId, status: "unsupported", sequence: 1 },
    },
    { operationId, status: "applied", item: item(), sequence: 0 },
    { operationId, status: "unsupported", unexpected: true },
  ])
    expect(() => decodeRemoteOperationResult(input, userId)).toThrow()
})

test("the UTF8 byte guard includes the result wrapper around valid effects", () => {
  const input = applied()
  const base = bytes({ ...input.outcome.effects, effects: [] })
  const unit = bytes(input.outcome.effects.effects[0]) + 1
  const overhead = bytes(input) - bytes(input.outcome.effects)
  const count = Math.floor(
    (maximumRemoteOperationResultBytes - base - overhead) / unit
  )
  input.outcome.effects.effects = Array.from({ length: count }, effect)
  const last = input.outcome.effects.effects.at(-1)
  if (!last) throw new Error("Expected byte boundary effect")
  while (bytes(input) <= maximumRemoteOperationResultBytes) {
    last.record.name += "界"
    last.record.normalizedName = last.record.name.toLowerCase()
  }
  expect(last.record.name.length).toBeLessThanOrEqual(60)
  expect(bytes(input.outcome.effects)).toBeLessThanOrEqual(
    maximumRemoteOperationResultBytes
  )
  expect(
    remotePreferenceEffectsSchema.safeParse(input.outcome.effects).success
  ).toBe(true)
  expect(JSON.stringify(input).length).toBeLessThan(
    maximumRemoteOperationResultBytes
  )
  expect(remoteOperationResultV2Schema.safeParse(input).success).toBe(false)
  expect(() => decodeRemoteOperationResult(input, userId)).toThrow()
})
