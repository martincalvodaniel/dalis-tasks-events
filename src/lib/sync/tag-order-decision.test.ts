import { expect, test } from "bun:test"
import { tagOrderResolutionFixture } from "@/lib/backup/tag-order-resolution-fixture"
import { compareRank } from "@/lib/ordering/rank"
import { planRemoteTagOperation } from "@/lib/preferences/remote-tag-plan"
import {
  availableTagOrderResolutionChoices,
  planTagOrderIncidentResolution,
  validateTagOrderResolutionRecord,
} from "@/lib/sync/tag-order-decision"
import { captureTagOrderResolutionSnapshot } from "@/lib/sync/tag-order-resolution"
import type { TagOrderResolutionSnapshot } from "@/types/tag-order-resolution"

function request(snapshot: TagOrderResolutionSnapshot, retry = true) {
  return {
    userId: snapshot.incident.entry.userId,
    resolutionId: crypto.randomUUID(),
    operationId: retry ? crypto.randomUUID() : null,
    choice: retry ? ("retry_latest_move" as const) : ("adopt_remote" as const),
    createdAt: "2026-10-18T20:30:00.000Z",
    expected: snapshot,
  }
}
function observed(
  f: ReturnType<typeof tagOrderResolutionFixture>,
  tags: typeof f.observed
) {
  const primary = tags.find((tag) => tag.id === f.original[0].id)
  if (!primary) throw new Error("Fixture primary missing")
  return captureTagOrderResolutionSnapshot({
    ...f.capture,
    observedTags: tags,
    entries: f.capture.entries.map((entry) =>
      entry.operation.operationId === f.child.operation.operationId
        ? f.child
        : entry
    ),
    incident: {
      ...f.capture.incident,
      intentions: f.capture.incident.intentions.map((entry) =>
        entry.operation.operationId === f.child.operation.operationId
          ? f.child
          : entry
      ),
      remote: [
        {
          entityKey: f.entry.entityKey,
          record: { store: "tags", record: primary },
        },
      ],
    },
  })
}

test("order adoption preserves the entire observed catalog without operations or local field replay", () => {
  const f = tagOrderResolutionFixture(),
    snapshot = observed(
      f,
      f.observed.map((tag) =>
        tag.id === f.original[0].id
          ? {
              ...tag,
              revision: 3,
              name: "Remote name",
              normalizedName: "remote name",
              color: "#ffffff",
            }
          : tag
      )
    ),
    input = request(snapshot, false),
    before = JSON.stringify(input),
    record = planTagOrderIncidentResolution(input, snapshot)
  expect(availableTagOrderResolutionChoices(snapshot, f.actor)).toEqual([
    "adopt_remote",
    "retry_latest_move",
  ])
  expect(record.tags).toEqual(snapshot.observedTags)
  expect(record.replacement).toBeNull()
  expect(record.supersededOperationIds).toEqual([
    f.entry.operation.operationId,
    f.child.operation.operationId,
  ])
  expect(record.latestMoveOperationId).toBe(f.child.operation.operationId)
  expect(validateTagOrderResolutionRecord(record, f.actor)).toEqual(record)
  expect(JSON.stringify(input)).toBe(before)
})
test("retry replays only the latest command with new identity and observed CAS, without optimistic revision increments", () => {
  const f = tagOrderResolutionFixture(),
    input = request(f.snapshot),
    before = JSON.stringify(f.snapshot),
    record = planTagOrderIncidentResolution(input, f.snapshot)
  if (!input.operationId) throw new Error("Fixture retry identity missing")
  expect(record.replacement).toEqual({
    ...f.child.operation,
    operationId: input.operationId,
    baseRevision: 2,
  })
  expect(record.replacement?.command).not.toEqual(f.entry.operation.command)
  const primary = record.tags.find((tag) => tag.id === f.original[0].id)
  expect(primary).toEqual({
    ...f.observed[0],
    position: 3072,
    updatedAt: input.createdAt,
  })
  expect(record.tags.toSorted(compareRank).map((tag) => tag.id)).toEqual([
    f.original[1].id,
    f.original[2].id,
    f.original[0].id,
  ])
  const remote = planRemoteTagOperation({
    userId: f.actor,
    timestamp: input.createdAt,
    operation: record.replacement,
    tags: f.observed,
  })
  expect(remote.status).toBe("changes")
  if (remote.status !== "changes")
    throw new Error("Preview remote effect missing")
  expect(remote.effects[0].record.revision).toBe(3)
  expect(validateTagOrderResolutionRecord(record, f.actor)).toEqual(record)
  expect(JSON.stringify(f.snapshot)).toBe(before)
})
test("retry retains observed remote names, colors, additions and unrelated tombstones", () => {
  const f = tagOrderResolutionFixture(),
    extra = {
      ...f.observed[1],
      id: crypto.randomUUID(),
      name: "Deleted",
      normalizedName: "deleted",
      deletedAt: f.now,
    },
    snapshot = observed(f, [
      ...f.observed.map((tag) =>
        tag.id === f.original[0].id
          ? {
              ...tag,
              revision: 3,
              name: "Changed",
              normalizedName: "changed",
              color: "#abcdef",
            }
          : tag
      ),
      extra,
    ]),
    record = planTagOrderIncidentResolution(request(snapshot), snapshot)
  expect(record.tags.find((tag) => tag.id === extra.id)).toEqual(extra)
  expect(record.tags.find((tag) => tag.id === f.original[0].id)).toMatchObject({
    name: "Changed",
    normalizedName: "changed",
    color: "#abcdef",
    revision: 3,
  })
  expect(record.tags).toHaveLength(4)
})
test("reranking previews every affected peer while preserving independent observed revisions", () => {
  const f = tagOrderResolutionFixture()
  if (f.child.operation.command.type !== "tag.move")
    throw new Error("Fixture move missing")
  f.child.operation.command.beforeId = f.original[2].id
  f.child.operation.command.afterId = f.original[1].id
  const sorted = [f.original[1], f.original[2]].sort((a, b) =>
    a.id < b.id ? -1 : 1
  )
  f.child.operation.command.afterId = sorted[0].id
  f.child.operation.command.beforeId = sorted[1].id
  const snapshot = observed(
      f,
      f.observed.map((tag, index) =>
        index === 0 ? tag : { ...tag, position: 0, revision: index + 5 }
      )
    ),
    input = request(snapshot),
    record = planTagOrderIncidentResolution(input, snapshot)
  expect(record.tags.toSorted(compareRank).map((tag) => tag.id)).toEqual([
    sorted[0].id,
    f.original[0].id,
    sorted[1].id,
  ])
  expect(record.tags.toSorted(compareRank).map((tag) => tag.position)).toEqual([
    -1024, 0, 1024,
  ])
  for (const tag of record.tags) {
    const remote = snapshot.observedTags.find((value) => value.id === tag.id)
    if (!remote) throw new Error("Fixture observed peer missing")
    expect(tag.revision).toBe(remote.revision)
    expect(tag.updatedAt).toBe(input.createdAt)
  }
  expect(validateTagOrderResolutionRecord(record, f.actor)).toEqual(record)
})
test("removed or changed neighbors and primary tombstones permit adoption only", () => {
  const f = tagOrderResolutionFixture()
  const extra = {
    ...f.observed[1],
    id: crypto.randomUUID(),
    name: "New",
    normalizedName: "new",
    position: 4096,
  }
  const snapshots = [
    observed(
      f,
      f.observed.map((tag, index) =>
        index === 2 ? { ...tag, deletedAt: f.now } : tag
      )
    ),
    observed(f, [...f.observed, extra]),
    observed(
      f,
      f.observed.map((tag, index) =>
        index === 0 ? { ...tag, revision: 3, deletedAt: f.now } : tag
      )
    ),
  ]
  for (const snapshot of snapshots) {
    expect(availableTagOrderResolutionChoices(snapshot, f.actor)).toEqual([
      "adopt_remote",
    ])
    expect(() =>
      planTagOrderIncidentResolution(request(snapshot), snapshot)
    ).toThrow()
    expect(
      planTagOrderIncidentResolution(request(snapshot, false), snapshot).tags
    ).toEqual(snapshot.observedTags)
  }
})
test("revision exhaustion of primary or a reranked peer is never hidden by optimistic preview", () => {
  const f = tagOrderResolutionFixture(),
    exhausted = observed(
      f,
      f.observed.map((tag, index) =>
        index === 0 ? { ...tag, revision: Number.MAX_SAFE_INTEGER } : tag
      )
    )
  expect(availableTagOrderResolutionChoices(exhausted, f.actor)).toEqual([
    "adopt_remote",
  ])
  if (f.child.operation.command.type !== "tag.move")
    throw new Error("Fixture move missing")
  const peers = f.observed.slice(1).toSorted((a, b) => (a.id < b.id ? -1 : 1))
  f.child.operation.command.beforeId = peers[1].id
  f.child.operation.command.afterId = peers[0].id
  const snapshot = observed(
    f,
    f.observed.map((tag, index) =>
      index === 0
        ? tag
        : {
            ...tag,
            position: 0,
            revision: index === 1 ? Number.MAX_SAFE_INTEGER : 1,
          }
    )
  )
  expect(availableTagOrderResolutionChoices(snapshot, f.actor)).toEqual([
    "adopt_remote",
  ])
  expect(() =>
    planTagOrderIncidentResolution(request(snapshot), snapshot)
  ).toThrow()
  expect(
    planTagOrderIncidentResolution(request(snapshot, false), snapshot)
      .replacement
  ).toBeNull()
})
test("stale snapshots, foreign accounts and reused identities cannot produce decisions", () => {
  const f = tagOrderResolutionFixture(),
    input = request(f.snapshot),
    changed = structuredClone(f.snapshot)
  changed.localTags[0].position += 1
  for (const value of [
    { ...input, userId: "foreign" },
    { ...input, operationId: input.resolutionId },
    { ...input, resolutionId: f.entry.operation.operationId },
    { ...input, operationId: f.child.operation.operationId },
    { ...input, choice: "adopt_remote" },
    { ...input, operationId: null },
  ])
    expect(() => planTagOrderIncidentResolution(value, f.snapshot)).toThrow()
  expect(() => planTagOrderIncidentResolution(input, changed)).toThrow()
  expect(availableTagOrderResolutionChoices(f.snapshot, "foreign")).toEqual([])
})
test("durable validation rejects altered projections, commands, supersession and latest references", () => {
  const f = tagOrderResolutionFixture(),
    record = planTagOrderIncidentResolution(request(f.snapshot), f.snapshot)
  const mutations = [
    (r: typeof record) => {
      r.tags[0].revision += 1
    },
    (r: typeof record) => {
      r.tags[0].color = "#ffffff"
    },
    (r: typeof record) => {
      r.tags.pop()
    },
    (r: typeof record) => {
      r.supersededOperationIds.reverse()
    },
    (r: typeof record) => {
      r.latestMoveOperationId = f.entry.operation.operationId
    },
    (r: typeof record) => {
      if (r.replacement) r.replacement.baseRevision = 1
    },
    (r: typeof record) => {
      if (r.replacement) r.replacement.command = f.entry.operation.command
    },
  ]
  for (const mutate of mutations) {
    const value = structuredClone(record)
    mutate(value)
    expect(() => validateTagOrderResolutionRecord(value, f.actor)).toThrow()
  }
  expect(() => validateTagOrderResolutionRecord(record, "foreign")).toThrow()
})
test("large rank compaction is unavailable instead of truncating effects", () => {
  const f = tagOrderResolutionFixture(),
    others = Array.from({ length: 1500 }, (_, index) => ({
      ...f.observed[1],
      id: crypto.randomUUID(),
      name: `${index} ${"ñ".repeat(50)}`,
      normalizedName: `${index} ${"ñ".repeat(50)}`,
      position: 0,
    })).toSorted(compareRank)
  if (f.child.operation.command.type !== "tag.move")
    throw new Error("Fixture move missing")
  f.child.operation.command.afterId = others[0].id
  f.child.operation.command.beforeId = others[1].id
  const snapshot = observed(f, [...f.observed, ...others])
  expect(availableTagOrderResolutionChoices(snapshot, f.actor)).toEqual([
    "adopt_remote",
  ])
  expect(() =>
    planTagOrderIncidentResolution(request(snapshot), snapshot)
  ).toThrow()
  expect(
    planTagOrderIncidentResolution(request(snapshot, false), snapshot).tags
  ).toHaveLength(1503)
})
