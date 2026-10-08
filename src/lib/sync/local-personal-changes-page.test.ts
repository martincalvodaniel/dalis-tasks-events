import { expect, test } from "bun:test"
import { planLocalPersonalChangesPage } from "@/lib/sync/local-personal-changes-page"
import type { PreferenceEffect } from "@/types/preference-effects"

const userId = "personal-page-owner"
const id = crypto.randomUUID()
const itemId = crypto.randomUUID()
const now = "2026-10-08T00:00:00.000Z"
function tag(
  revision: number,
  deletedAt: string | null = null
): PreferenceEffect {
  return {
    store: "tags",
    record: {
      id,
      userId,
      name: "Category",
      normalizedName: "category",
      color: "#123456",
      position: 0,
      revision,
      createdAt: now,
      updatedAt: now,
      deletedAt,
    },
  }
}
function fixture(groups: PreferenceEffect[][] = [[tag(2)], [tag(3, now)]]) {
  const changes = groups.map((effects, index) => {
    const operationId = crypto.randomUUID()
    return {
      version: 2,
      kind: "preference",
      recipientUserId: userId,
      operationId,
      sequence: index + 1,
      effects: {
        version: 1,
        userId,
        operationId,
        sequence: index + 1,
        effects,
      },
    }
  })
  return {
    state: { userId, local: [], shadows: [], incoming: null, entries: [] },
    receipt: {
      query: { after: 0, through: null, limit: 50 },
      page: {
        version: 2,
        changes,
        nextAfter: groups.length,
        through: groups.length,
        hasMore: false,
      },
    },
  }
}

test("personal page processes complete effect groups with independent revisions and tombstones", () => {
  const view: PreferenceEffect = {
    store: "itemViews",
    record: {
      userId,
      itemId,
      primaryTagId: id,
      revision: 8,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  }
  const input = fixture([[tag(2), view], [tag(3, now)], [tag(1)]])
  const before = structuredClone(input)
  const result = planLocalPersonalChangesPage(input, userId)
  expect(result.pending).toBe(false)
  expect(result.local).toHaveLength(2)
  expect(result.shadows.map((shadow) => shadow.record.record.revision)).toEqual(
    [3, 8]
  )
  expect(result.shadows[0].record.record.deletedAt).toBe(now)
  result.shadows[0].record.record.userId = "modified-clone"
  expect(input).toEqual(before)
})

test("personal page retains the entire optimistic local chain while collecting all remote shadows", () => {
  const input = fixture()
  const local = [{ entityKey: `tag:${id}`, record: tag(0) }]
  const entries = [
    {
      userId,
      entityKey: `tag:${id}`,
      sequence: 1,
      dependencies: [],
      state: "pending",
      attempts: 0,
      createdAt: now,
      lease: null,
      operation: {
        protocolVersion: 1,
        operationId: crypto.randomUUID(),
        baseRevision: 0,
        command: { type: "tag.delete", tagId: id },
      },
    },
  ]
  const value = { ...input, state: { ...input.state, local, entries } }
  const before = structuredClone(value)
  const result = planLocalPersonalChangesPage(value, userId)
  expect(result.pending).toBe(true)
  expect(result.local).toEqual(local)
  expect(result.shadows[0].record.record.revision).toBe(3)
  expect(result.shadows[0].record.record.deletedAt).toBe(now)
  expect(value).toEqual(before)
})

test("a late contradictory effect rejects the complete personal plan instead of collapsing intermediate history", () => {
  const input = fixture([[tag(2)], [tag(2, now)], [tag(3)]])
  const before = structuredClone(input)
  expect(() => planLocalPersonalChangesPage(input, userId)).toThrow(
    "same revision"
  )
  expect(input).toEqual(before)
})

test("personal page validates empty receipts, actor, full state and future evidence before returning a plan", () => {
  const input = fixture([])
  expect(planLocalPersonalChangesPage(input, userId)).toEqual({
    local: [],
    shadows: [],
    pending: false,
  })
  for (const invalid of [
    { ...input, state: { ...input.state, userId: "other-owner" } },
    { ...input, state: { ...input.state, incoming: { version: 1 } } },
    { ...input, state: { ...input.state, shadows: [{ version: 3 }] } },
    {
      ...input,
      receipt: {
        ...input.receipt,
        page: { ...input.receipt.page, version: 3 },
      },
    },
    { ...input, extra: true },
  ])
    expect(() => planLocalPersonalChangesPage(invalid, userId)).toThrow()
  expect(() => planLocalPersonalChangesPage(input, "other-owner")).toThrow()
})
