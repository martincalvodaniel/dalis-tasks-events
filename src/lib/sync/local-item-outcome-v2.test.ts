import { expect, test } from "bun:test"
import { decodeLocalItemOutcome } from "@/lib/sync/local-item-outcome-v2"
import type { CalendarItem } from "@/types/calendar-item"

const actor = "outcome-owner"
const timestamp = "2026-10-08T00:00:00.000Z"
function fixture() {
  const id = crypto.randomUUID()
  const operationId = crypto.randomUUID()
  const record: CalendarItem = {
    id,
    ownerId: actor,
    kind: "task",
    title: "Observed task",
    description: "",
    scheduledDate: "2026-10-08",
    status: "not_started",
    checklist: [],
    completedAt: null,
    recurrence: null,
    revision: 5,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  return {
    key: `operation-outcome:${operationId}`,
    operation: {
      operationId,
      protocolVersion: 1 as const,
      baseRevision: 1,
      command: { type: "item.delete" as const, itemId: id },
    },
    result: {
      operationId,
      status: "conflict" as const,
      current: { ...record, revision: 2 },
    },
    local: { ...record, revision: 0 },
    base: record,
  }
}

test("legacy replay can precede the observed shadow without inventing ancestry or rewriting evidence", () => {
  const input = fixture()
  const before = structuredClone(input)
  const value = decodeLocalItemOutcome(input, actor)
  expect(value).toEqual({
    ...input,
    version: 2,
    kind: "item",
    result: { kind: "item", outcome: input.result },
  })
  expect(value.base?.revision).toBe(5)
  expect(value.local?.revision).toBe(0)
  expect(decodeLocalItemOutcome(value, actor)).toEqual(value)
  if (!value.base) throw new Error("Expected observed shadow")
  value.base.title = "Mutated clone"
  value.operation.baseRevision = 10
  expect(input).toEqual(before)
})

test("applied tombstones and rejected histories preserve their exact results", () => {
  const input = fixture()
  const result = {
    operationId: input.operation.operationId,
    status: "applied" as const,
    sequence: 1,
    item: { ...input.base, revision: 2, deletedAt: timestamp },
  }
  expect(
    decodeLocalItemOutcome({ ...input, result }, actor).result.outcome
  ).toEqual(result)
  for (const status of [
    "unsupported",
    "unavailable",
    "invalid_command",
    "identity_reuse",
  ] as const) {
    const result = { operationId: input.operation.operationId, status }
    expect(
      decodeLocalItemOutcome(
        { ...input, result, local: null, base: null },
        actor
      ).result.outcome
    ).toEqual(result)
  }
})

test("corrupt identities, foreign snapshots and future or ambiguous envelopes reject", () => {
  const input = fixture()
  const normalized = decodeLocalItemOutcome(input, actor)
  for (const invalid of [
    { ...input, key: `operation-outcome:${crypto.randomUUID()}` },
    { ...input, result: { ...input.result, operationId: crypto.randomUUID() } },
    { ...input, local: { ...input.local, ownerId: "foreign" } },
    { ...input, base: { ...input.base, id: crypto.randomUUID() } },
    {
      ...input,
      result: {
        ...input.result,
        current: { ...input.result.current, ownerId: "foreign" },
      },
    },
    {
      ...input,
      result: {
        ...input.result,
        current: { ...input.result.current, id: crypto.randomUUID() },
      },
    },
    { ...normalized, version: 3 },
    { ...normalized, kind: "preference" },
    { ...normalized, unexpected: true },
    { ...input, version: 2 },
  ])
    expect(() => decodeLocalItemOutcome(invalid, actor)).toThrow()
  expect(() => decodeLocalItemOutcome(input, "foreign")).toThrow()
  expect(() => decodeLocalItemOutcome(input, "")).toThrow()
})
