import { expect, test } from "bun:test"
import { decodeRemoteChange } from "@/lib/sync/remote-change-v2"
import { validateRemoteChangesPageV2 } from "@/lib/sync/remote-changes-page-v2"
import { remoteChangeV2Schema } from "@/schemas/remote-change-v2"
import {
  maximumRemoteChangesPageBytes,
  remoteChangesPageV2Schema,
} from "@/schemas/remote-changes-page-v2"
import type { RemoteChangeV2 } from "@/types/remote-change-v2"

const userId = "mixed-page-owner"
const timestamp = "2026-10-08T00:00:00.000Z"
const metadata = {
  revision: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
}
function item(sequence = 1): RemoteChangeV2 {
  return decodeRemoteChange(
    {
      recipientUserId: userId,
      operationId: crypto.randomUUID(),
      sequence,
      item: {
        ...metadata,
        id: crypto.randomUUID(),
        ownerId: userId,
        kind: "task",
        title: "Test task",
        description: "",
        scheduledDate: "2026-10-08",
        status: "not_started",
        checklist: [],
        completedAt: null,
        recurrence: null,
      },
    },
    userId
  )
}
function personal(sequence = 2, count = 1): RemoteChangeV2 {
  const operationId = crypto.randomUUID()
  return {
    version: 2,
    kind: "preference",
    recipientUserId: userId,
    operationId,
    sequence,
    effects: {
      version: 1,
      userId,
      operationId,
      sequence,
      effects: Array.from({ length: count }, () => ({
        store: "tags" as const,
        record: {
          ...metadata,
          id: crypto.randomUUID(),
          userId,
          name: "ñ".repeat(60),
          normalizedName: "ñ".repeat(60),
          color: "#123456",
          position: 0,
          deletedAt: timestamp,
        },
      })),
    },
  }
}
function page(
  changes: RemoteChangeV2[],
  through = changes.at(-1)?.sequence ?? 0
) {
  const nextAfter = changes.at(-1)?.sequence ?? 0
  return {
    version: 2 as const,
    changes,
    nextAfter,
    through,
    hasMore: nextAfter < through,
  }
}

test("mixed pages preserve every normalized legacy and personal record without mutating sources", () => {
  const value = page([item(), personal()])
  const before = structuredClone(value)
  const decoded = validateRemoteChangesPageV2(value, userId, {})
  expect(decoded.changes.map((change) => change.kind)).toEqual([
    "item",
    "preference",
  ])
  expect(decoded.nextAfter).toBe(2)
  expect(decoded.hasMore).toBe(false)
  if (decoded.changes[0].kind === "item")
    decoded.changes[0].item.title = "Changed clone"
  if (decoded.changes[1].kind === "preference") {
    expect(decoded.changes[1].effects.effects[0].record.deletedAt).toBe(
      timestamp
    )
    decoded.changes[1].effects.effects[0].record.userId = "changed-clone"
  }
  expect(value).toEqual(before)
  expect(
    validateRemoteChangesPageV2(page([personal(3)], 5), userId, {
      after: "2",
      through: "5",
      limit: "1",
    }).hasMore
  ).toBe(true)
  expect(
    validateRemoteChangesPageV2(page([item(5)]), userId, {
      after: 4,
      through: 5,
    }).nextAfter
  ).toBe(5)
  const empty = {
    version: 2,
    changes: [],
    nextAfter: 5,
    through: 5,
    hasMore: false,
  }
  expect(
    validateRemoteChangesPageV2(empty, userId, { after: 5, through: 5 }).changes
  ).toHaveLength(0)
  expect(validateRemoteChangesPageV2(page([]), userId, {}).nextAfter).toBe(0)
})

test("range and account verification rejects holes, skipped empty pages and changed checkpoints", () => {
  const value = page([item(), personal()])
  for (const query of [
    { after: 1 },
    { limit: 1 },
    { through: 3 },
    { through: 1 },
    { after: 3, through: 2 },
    { limit: 0 },
  ])
    expect(() => validateRemoteChangesPageV2(value, userId, query)).toThrow()
  expect(() => validateRemoteChangesPageV2(value, "other-user", {})).toThrow()
  expect(() => validateRemoteChangesPageV2(value, "", {})).toThrow()
  const partialForeign = structuredClone(value)
  const last = partialForeign.changes[1]
  if (last.kind !== "preference") throw new Error("Expected preference fixture")
  last.recipientUserId = "other-user"
  last.effects.userId = "other-user"
  for (const effect of last.effects.effects) effect.record.userId = "other-user"
  expect(remoteChangesPageV2Schema.safeParse(partialForeign).success).toBe(true)
  expect(() =>
    validateRemoteChangesPageV2(partialForeign, userId, {})
  ).toThrow()
  for (const empty of [
    { version: 2, changes: [], nextAfter: 1, through: 1, hasMore: false },
    { version: 2, changes: [], nextAfter: 0, through: 1, hasMore: true },
  ])
    expect(() => validateRemoteChangesPageV2(empty, userId, {})).toThrow()
})

test("strict pages reject duplicated operations, noncontiguous sequences and incompatible shapes", () => {
  const value = page([item(), personal()])
  const duplicate = item(2)
  duplicate.operationId = value.changes[0].operationId
  for (const invalid of [
    page([item(1), personal(3)]),
    page([item(2), personal(1)]),
    page([value.changes[0], duplicate]),
    { ...value, nextAfter: 1 },
    { ...value, through: 1 },
    { ...value, hasMore: true },
    { ...value, version: 3 },
    { ...value, unexpected: true },
    { ...value, changes: [{ ...value.changes[0], version: 3 }] },
    { changes: [], nextAfter: 0, through: 0, hasMore: false },
  ])
    expect(() => remoteChangesPageV2Schema.parse(invalid)).toThrow()
  const maximum = page(
    Array.from({ length: 100 }, (_, index) => item(index + 1))
  )
  expect(
    validateRemoteChangesPageV2(maximum, userId, { limit: 100 }).changes
  ).toHaveLength(100)
  expect(() =>
    remoteChangesPageV2Schema.parse(page([...maximum.changes, item(101)]))
  ).toThrow()
})

test("the page byte guard rejects a whole UTF8 page made of individually valid records", () => {
  const changes: RemoteChangeV2[] = []
  do {
    changes.push(personal(changes.length + 1, 200))
  } while (
    new TextEncoder().encode(JSON.stringify(page(changes))).byteLength <=
    maximumRemoteChangesPageBytes
  )
  expect(changes.length).toBeLessThanOrEqual(100)
  for (const change of changes)
    expect(remoteChangeV2Schema.safeParse(change).success).toBe(true)
  const oversized = page(changes)
  expect(JSON.stringify(oversized).length).toBeLessThan(
    maximumRemoteChangesPageBytes
  )
  expect(() => remoteChangesPageV2Schema.parse(oversized)).toThrow()
  const smaller = page(changes.slice(0, -1), oversized.through)
  expect(
    validateRemoteChangesPageV2(smaller, userId, { limit: 100 }).hasMore
  ).toBe(true)
  expect(smaller.changes.at(-1)?.sequence).toBe(smaller.nextAfter)
})
