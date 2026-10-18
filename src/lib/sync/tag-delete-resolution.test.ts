import { expect, test } from "bun:test"
import { tagDeletionResolutionFixture } from "@/lib/backup/tag-delete-resolution-fixture"
import { tagOrderResolutionFixture } from "@/lib/backup/tag-order-resolution-fixture"
import {
  captureTagDeletionResolutionSnapshot,
  validateTagDeletionResolutionSnapshot,
} from "@/lib/sync/tag-delete-resolution"
import { validateTagOrderResolutionSnapshot } from "@/lib/sync/tag-order-resolution"
import { outboxEntrySchema } from "@/schemas/local-sync"

test("deletion capture preserves exact local tombstone, observed catalog, source and frozen outcome", () => {
  const f = tagDeletionResolutionFixture(),
    before = JSON.stringify(f.capture)
  expect(f.snapshot.incident.intentions).toEqual([f.entry])
  expect(
    f.snapshot.localTags.find((tag) => tag.id === f.original[0].id)?.deletedAt
  ).toBe(f.now)
  expect(
    f.snapshot.observedTags.find((tag) => tag.id === f.original[0].id)
      ?.deletedAt
  ).toBeNull()
  expect(validateTagDeletionResolutionSnapshot(f.snapshot, f.actor)).toEqual(
    f.snapshot
  )
  expect(JSON.stringify(f.capture)).toBe(before)
  expect(() =>
    validateTagOrderResolutionSnapshot(f.snapshot, f.actor)
  ).toThrow()
  expect(() =>
    validateTagDeletionResolutionSnapshot(
      tagOrderResolutionFixture().snapshot,
      f.actor
    )
  ).toThrow()
})
test("deletion never admits extra deletes, category saves or assignments into a partial review", () => {
  const f = tagDeletionResolutionFixture()
  for (const command of [
    f.entry.operation.command,
    {
      type: "tag.save",
      tagId: f.original[0].id,
      input: { name: "New", color: "#abcdef", position: 1 },
    },
    {
      type: "item-view.set",
      itemId: crypto.randomUUID(),
      primaryTagId: f.original[0].id,
    },
  ]) {
    const child = outboxEntrySchema.parse({
      ...f.entry,
      state: "pending",
      attempts: 0,
      sequence: 2,
      dependencies: [f.entry.operation.operationId],
      entityKey:
        command.type === "item-view.set"
          ? `item-view:${command.itemId}`
          : f.entry.entityKey,
      operation: {
        ...f.entry.operation,
        operationId: crypto.randomUUID(),
        command,
      },
    })
    expect(() =>
      captureTagDeletionResolutionSnapshot({
        ...f.capture,
        entries: [f.entry, child],
        incident: { ...f.capture.incident, intentions: [f.entry, child] },
      })
    ).toThrow()
  }
})
test("deletion needs its complete local tombstone and known primary, never absence or foreign data", () => {
  const f = tagDeletionResolutionFixture()
  for (const change of [
    { ...f.capture, userId: "foreign" },
    { ...f.capture, localTags: f.original },
    { ...f.capture, observedTags: f.observed.slice(1) },
    {
      ...f.capture,
      localTags: f.local.map((tag, index) =>
        index === 1 ? { ...tag, userId: "foreign" } : tag
      ),
    },
  ])
    expect(() => captureTagDeletionResolutionSnapshot(change)).toThrow()
  expect(() =>
    validateTagDeletionResolutionSnapshot(f.snapshot, "foreign")
  ).toThrow()
})
test("only the reviewed deletion may restore its local tombstone through a later explicit adoption", () => {
  const f = tagDeletionResolutionFixture()
  expect(() =>
    captureTagDeletionResolutionSnapshot({
      ...f.capture,
      localTags: f.local.map((tag, index) =>
        index === 1 ? { ...tag, deletedAt: f.now } : tag
      ),
    })
  ).toThrow("resurrect")
  const remote = { ...f.observed[0], revision: 3, deletedAt: f.now }
  const current = captureTagDeletionResolutionSnapshot({
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
  expect(
    current.observedTags.find((tag) => tag.id === remote.id)?.deletedAt
  ).toBe(f.now)
})
test("deletion freshness is observed evidence rather than an invented ancestor", () => {
  const f = tagDeletionResolutionFixture(),
    remote = { ...f.observed[0], revision: 3, color: "#abcdef" },
    incident = {
      ...f.capture.incident,
      remote: [
        {
          entityKey: f.entry.entityKey,
          record: { store: "tags", record: remote },
        },
      ],
    }
  expect(
    captureTagDeletionResolutionSnapshot({
      ...f.capture,
      incident,
      observedTags: [remote, ...f.observed.slice(1)],
    }).observedTags.find((tag) => tag.id === remote.id)?.revision
  ).toBe(3)
  expect(() =>
    captureTagDeletionResolutionSnapshot({
      ...f.capture,
      observedTags: f.original,
    })
  ).toThrow()
})
test("deletion preserves transitive acknowledged history without equating its DTO with proof", () => {
  const f = tagDeletionResolutionFixture(),
    parent = {
      ...f.entry,
      state: "acknowledged" as const,
      sequence: 1,
      dependencies: [],
      operation: { ...f.entry.operation, operationId: crypto.randomUUID() },
    },
    entry = {
      ...f.entry,
      sequence: 2,
      dependencies: [parent.operation.operationId],
    }
  const snapshot = captureTagDeletionResolutionSnapshot({
    ...f.capture,
    entries: [parent, entry],
    incident: { ...f.capture.incident, entry, intentions: [entry] },
  })
  expect(snapshot.acknowledgedDependencies).toEqual([parent])
  expect(() =>
    validateTagDeletionResolutionSnapshot(
      { ...snapshot, acknowledgedDependencies: [] },
      f.actor
    )
  ).toThrow()
})
test("deletion cannot review an uncertain attempt or silently truncate catalogs", () => {
  const f = tagDeletionResolutionFixture()
  for (const entry of [
    { ...f.entry, attempts: 0 },
    { ...f.entry, state: "pending", attempts: 1 },
  ])
    expect(() =>
      captureTagDeletionResolutionSnapshot({
        ...f.capture,
        entries: [entry],
        incident: { ...f.capture.incident, entry, intentions: [entry] },
      })
    ).toThrow()
  expect(() =>
    captureTagDeletionResolutionSnapshot({
      ...f.capture,
      observedTags: Array.from({ length: 10001 }, () => f.observed[0]),
    })
  ).toThrow()
})
