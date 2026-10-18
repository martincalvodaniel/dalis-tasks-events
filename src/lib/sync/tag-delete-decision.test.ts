import { expect, test } from "bun:test"
import { tagDeletionResolutionFixture } from "@/lib/backup/tag-delete-resolution-fixture"
import { planRemoteTagOperation } from "@/lib/preferences/remote-tag-plan"
import {
  availableTagDeletionResolutionChoices,
  planTagDeletionIncidentResolution,
  validateTagDeletionResolutionRecord,
} from "@/lib/sync/tag-delete-decision"
import { captureTagDeletionResolutionSnapshot } from "@/lib/sync/tag-delete-resolution"
import type { TagCatalogResolutionSnapshot } from "@/types/tag-catalog-resolution"

function request(snapshot: TagCatalogResolutionSnapshot, retry = true) {
  return {
    userId: snapshot.incident.entry.userId,
    resolutionId: crypto.randomUUID(),
    operationId: retry ? crypto.randomUUID() : null,
    choice: retry ? "retry_delete" : "adopt_remote",
    createdAt: "2026-10-18T21:00:00.000Z",
    expected: snapshot,
  }
}

test("explicit deletion adoption restores only reviewed remote catalog and creates no operation", () => {
  const f = tagDeletionResolutionFixture(),
    input = request(f.snapshot, false),
    before = JSON.stringify(input),
    record = planTagDeletionIncidentResolution(input, f.snapshot)
  expect(record.tags).toEqual(f.snapshot.observedTags)
  expect(
    record.tags.find((tag) => tag.id === f.original[0].id)?.deletedAt
  ).toBeNull()
  expect(record.replacement).toBeNull()
  expect(record.supersededOperationIds).toEqual([f.entry.operation.operationId])
  expect(validateTagDeletionResolutionRecord(record, f.actor)).toEqual(record)
  expect(JSON.stringify(input)).toBe(before)
})
test("deletion retry keeps exact command with fresh UUID and observed CAS without inventing ACK", () => {
  const f = tagDeletionResolutionFixture(),
    input = request(f.snapshot),
    before = JSON.stringify(f.snapshot),
    record = planTagDeletionIncidentResolution(input, f.snapshot)
  expect(availableTagDeletionResolutionChoices(f.snapshot, f.actor)).toEqual([
    "adopt_remote",
    "retry_delete",
  ])
  expect(record.replacement?.command).toEqual(f.entry.operation.command)
  expect(record.replacement?.baseRevision).toBe(2)
  expect(record.replacement?.operationId).not.toBe(
    f.entry.operation.operationId
  )
  expect(record.tags.find((tag) => tag.id === f.original[0].id)).toEqual({
    ...f.observed[0],
    deletedAt: input.createdAt,
    updatedAt: input.createdAt,
  })
  for (const tag of f.observed.slice(1))
    expect(record.tags.find((peer) => peer.id === tag.id)).toEqual(tag)
  const remote = planRemoteTagOperation({
    userId: f.actor,
    timestamp: input.createdAt,
    operation: record.replacement,
    tags: f.observed,
  })
  expect(remote.status).toBe("changes")
  if (remote.status !== "changes")
    throw new Error("Deletion preview missing remote effect")
  expect(remote.effects[0].record.revision).toBe(3)
  expect(validateTagDeletionResolutionRecord(record, f.actor)).toEqual(record)
  expect(JSON.stringify(f.snapshot)).toBe(before)
})
test("an observed remote tombstone is adopted without repeating or undoing deletion", () => {
  const f = tagDeletionResolutionFixture(),
    remote = { ...f.observed[0], revision: 3, deletedAt: f.now },
    snapshot = captureTagDeletionResolutionSnapshot({
      ...f.capture,
      observedTags: [remote, ...f.observed.slice(1)],
      incident: {
        ...f.capture.incident,
        remote: [
          {
            entityKey: f.entry.entityKey,
            record: { store: "tags", record: remote },
          },
        ],
      },
    })
  expect(availableTagDeletionResolutionChoices(snapshot, f.actor)).toEqual([
    "adopt_remote",
  ])
  expect(() =>
    planTagDeletionIncidentResolution(request(snapshot), snapshot)
  ).toThrow()
  expect(
    planTagDeletionIncidentResolution(
      request(snapshot, false),
      snapshot
    ).tags.find((tag) => tag.id === remote.id)
  ).toEqual(remote)
})
test("revision exhaustion permits adoption only and never overflows CAS", () => {
  const f = tagDeletionResolutionFixture(),
    remote = { ...f.observed[0], revision: Number.MAX_SAFE_INTEGER },
    snapshot = captureTagDeletionResolutionSnapshot({
      ...f.capture,
      observedTags: [remote, ...f.observed.slice(1)],
      incident: {
        ...f.capture.incident,
        remote: [
          {
            entityKey: f.entry.entityKey,
            record: { store: "tags", record: remote },
          },
        ],
      },
    })
  expect(availableTagDeletionResolutionChoices(snapshot, f.actor)).toEqual([
    "adopt_remote",
  ])
  expect(() =>
    planTagDeletionIncidentResolution(request(snapshot), snapshot)
  ).toThrow()
  expect(
    planTagDeletionIncidentResolution(request(snapshot, false), snapshot)
      .replacement
  ).toBeNull()
})
test("deletion guards exact snapshot, actor and new decision identities", () => {
  const f = tagDeletionResolutionFixture(),
    input = request(f.snapshot),
    stale = structuredClone(f.snapshot)
  stale.observedTags[1].color = "#ffffff"
  expect(() => planTagDeletionIncidentResolution(input, stale)).toThrow()
  for (const change of [
    { ...input, userId: "foreign" },
    { ...input, operationId: input.resolutionId },
    { ...input, operationId: f.entry.operation.operationId },
    { ...input, resolutionId: f.entry.operation.operationId },
    { ...input, operationId: null },
    { ...input, choice: "adopt_remote" },
  ])
    expect(() =>
      planTagDeletionIncidentResolution(change, f.snapshot)
    ).toThrow()
  expect(availableTagDeletionResolutionChoices(f.snapshot, "foreign")).toEqual(
    []
  )
})
test("deletion record cannot forge remote fields, revisions, operation or supersession", () => {
  const f = tagDeletionResolutionFixture(),
    record = planTagDeletionIncidentResolution(request(f.snapshot), f.snapshot)
  const mutations = [
    (value: typeof record) => {
      value.tags[0].revision++
    },
    (value: typeof record) => {
      value.tags[0].color = "#abcdef"
    },
    (value: typeof record) => {
      value.tags.pop()
    },
    (value: typeof record) => {
      value.supersededOperationIds = [crypto.randomUUID()]
    },
    (value: typeof record) => {
      if (value.replacement) value.replacement.baseRevision = 1
    },
  ]
  for (const mutate of mutations) {
    const value = structuredClone(record)
    mutate(value)
    expect(() => validateTagDeletionResolutionRecord(value, f.actor)).toThrow()
  }
  expect(() => validateTagDeletionResolutionRecord(record, "foreign")).toThrow()
})
