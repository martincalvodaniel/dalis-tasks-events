import { expect, test } from "bun:test"
import {
  decodeRemoteChange,
  validateRemoteChangeV2,
} from "@/lib/sync/remote-change-v2"
import { remotePreferenceEffectsSchema } from "@/schemas/preference-effects"
import { maximumRemoteChangeBytes } from "@/schemas/remote-change-v2"
import type { CalendarItem } from "@/types/calendar-item"
import type { PreferenceEffect } from "@/types/preference-effects"

const userId = "journal-test-user"
const operationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const timestamp = "2026-10-08T00:00:00.000Z"
const metadata = {
  revision: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
}
function tag(): PreferenceEffect & { store: "tags" } {
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
function personal() {
  return {
    version: 2 as const,
    kind: "preference" as const,
    recipientUserId: userId,
    operationId,
    sequence: 2,
    effects: {
      version: 1 as const,
      userId,
      operationId,
      sequence: 2,
      effects: [tag()],
    },
  }
}
function legacy() {
  const item: CalendarItem = {
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
  return {
    recipientUserId: userId,
    operationId: crypto.randomUUID(),
    sequence: 1,
    item,
  }
}

test("mixed history retains top-level query keys, every effect, order and independent payloads", () => {
  const old = legacy()
  const next = personal()
  const second = tag()
  second.record.deletedAt = timestamp
  next.effects.effects.push(second)
  const sources = [old, next]
  const before = structuredClone(sources)
  const decoded = sources.map((entry) => decodeRemoteChange(entry, userId))
  expect(decoded.map((entry) => entry.sequence)).toEqual([1, 2])
  expect(decoded.map((entry) => entry.recipientUserId)).toEqual([
    userId,
    userId,
  ])
  expect(decoded[0]).toEqual({ ...old, version: 2, kind: "item" })
  expect(decoded[1]).toEqual(next)
  const itemChange = decoded[0]
  if (itemChange.kind === "item") itemChange.item.title = "Changed clone"
  const preferenceChange = decoded[1]
  if (preferenceChange.kind === "preference") {
    expect(preferenceChange.effects.effects).toHaveLength(2)
    preferenceChange.effects.effects[0].record.userId = "changed-clone"
  }
  expect(sources).toEqual(before)
  expect(
    validateRemoteChangeV2({ ...old, version: 2, kind: "item" }, userId)
      .sequence
  ).toBe(1)
})

test("recipient, operation and sequence must agree without accepting partial or future records", () => {
  const input = personal()
  expect(() => decodeRemoteChange(input, "another-user")).toThrow()
  expect(() => validateRemoteChangeV2(input, "")).toThrow()
  expect(() => decodeRemoteChange(legacy(), "another-user")).toThrow()
  for (const invalid of [
    { ...input, recipientUserId: "another-user" },
    { ...input, operationId: crypto.randomUUID() },
    { ...input, sequence: 3 },
    { ...input, sequence: 0 },
    { ...input, effects: { ...input.effects, effects: [] } },
    { ...input, effects: { ...input.effects, userId: "another-user" } },
    { ...input, kind: "future" },
    { ...input, version: 3 },
    { ...input, item: legacy().item },
    { ...legacy(), version: 2, kind: "item", effects: input.effects },
    { ...legacy(), item: { ...legacy().item, ownerId: "another-user" } },
    { ...legacy(), sequence: 0 },
    { ...legacy(), unexpected: true },
  ])
    expect(() => decodeRemoteChange(invalid, userId)).toThrow()
})

test("journal byte guard counts the complete UTF8 entry around valid effects", () => {
  const input = personal()
  const bytes = (value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value)).byteLength
  const empty = { ...input, effects: { ...input.effects, effects: [] } }
  const count = Math.floor(
    (maximumRemoteChangeBytes - bytes(empty)) / (bytes(tag()) + 1)
  )
  input.effects.effects = Array.from({ length: count }, tag)
  const last = input.effects.effects.at(-1)
  if (!last) throw new Error("Expected boundary effect")
  while (bytes(input) <= maximumRemoteChangeBytes) {
    last.record.name += "界"
    last.record.normalizedName = last.record.name.toLowerCase()
  }
  expect(last.record.name.length).toBeLessThanOrEqual(60)
  expect(remotePreferenceEffectsSchema.safeParse(input.effects).success).toBe(
    true
  )
  expect(JSON.stringify(input).length).toBeLessThan(maximumRemoteChangeBytes)
  expect(() => validateRemoteChangeV2(input, userId)).toThrow()
})
