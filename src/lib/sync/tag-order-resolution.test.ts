import { expect, test } from "bun:test"
import { tagOrderResolutionFixture } from "@/lib/backup/tag-order-resolution-fixture"
import {
  captureTagOrderResolutionSnapshot,
  validateTagOrderResolutionSnapshot,
} from "@/lib/sync/tag-order-resolution"
import { outboxEntrySchema } from "@/schemas/local-sync"

test("order capture retains every category and exact reviewed intention without changing input", () => {
  const f = tagOrderResolutionFixture(),
    before = JSON.stringify(f.capture)
  const current = captureTagOrderResolutionSnapshot(f.capture)
  expect(current.localTags).toHaveLength(3)
  expect(current.observedTags).toHaveLength(3)
  expect(current.incident.intentions).toEqual([f.entry, f.child])
  expect(current.acknowledgedDependencies).toEqual([])
  expect(
    current.localTags.find((tag) => tag.id === f.original[0].id)?.position
  ).toBe(3072)
  expect(
    current.observedTags.find((tag) => tag.id === f.original[0].id)?.revision
  ).toBe(2)
  expect(JSON.stringify(f.capture)).toBe(before)
  expect(validateTagOrderResolutionSnapshot(current, f.actor)).toEqual(current)
})
test("category arrays are canonical regardless of IndexedDB enumeration order", () => {
  const f = tagOrderResolutionFixture()
  expect(
    captureTagOrderResolutionSnapshot({
      ...f.capture,
      localTags: f.local.toReversed(),
      observedTags: f.observed.toReversed(),
    })
  ).toEqual(f.snapshot)
})
test("order capture refuses missing observed categories, duplicates, foreign ownership and uncommitted local identities", () => {
  const f = tagOrderResolutionFixture()
  for (const change of [
    { ...f.capture, observedTags: f.observed.slice(0, 2) },
    { ...f.capture, observedTags: [...f.observed, f.observed[1]] },
    { ...f.capture, localTags: [...f.local, f.local[1]] },
    {
      ...f.capture,
      observedTags: f.observed.map((tag, index) =>
        index === 1 ? { ...tag, userId: "foreign" } : tag
      ),
    },
    {
      ...f.capture,
      localTags: f.local.map((tag, index) =>
        index === 1 ? { ...tag, revision: 0 } : tag
      ),
    },
    { ...f.capture, userId: "foreign" },
  ])
    expect(() => captureTagOrderResolutionSnapshot(change)).toThrow()
  expect(() =>
    validateTagOrderResolutionSnapshot(f.snapshot, "foreign")
  ).toThrow()
})
test("known remote additions are preserved instead of claiming that the local catalog is the server's current complete catalog", () => {
  const f = tagOrderResolutionFixture(),
    additional = {
      ...f.original[1],
      id: crypto.randomUUID(),
      name: "Added",
      normalizedName: "added",
      position: 4096,
    }
  const current = captureTagOrderResolutionSnapshot({
    ...f.capture,
    observedTags: [...f.observed, additional],
  })
  expect(current.observedTags).toHaveLength(4)
  expect(current.localTags).toHaveLength(3)
})
test("order capture requires the complete connected chain and rejects uncertain attempts or another first conflict", () => {
  const f = tagOrderResolutionFixture()
  for (const entries of [
    [f.entry],
    [f.entry, { ...f.child, attempts: 1 }],
    [f.entry, { ...f.child, dependencies: [] }],
    [f.entry, { ...f.child, state: "acknowledged" }],
    [f.entry, f.child, f.child],
    [{ ...f.entry, dependencies: [crypto.randomUUID()] }, f.child],
  ])
    expect(() =>
      captureTagOrderResolutionSnapshot({ ...f.capture, entries })
    ).toThrow()
  const snapshot = structuredClone(f.snapshot)
  snapshot.incident.intentions.reverse()
  expect(() => validateTagOrderResolutionSnapshot(snapshot, f.actor)).toThrow()
})
test("other category writes and personal assignments remain protected even without a dependency edge", () => {
  const f = tagOrderResolutionFixture(),
    otherId = crypto.randomUUID()
  for (const command of [
    {
      type: "tag.save",
      tagId: otherId,
      input: { name: "Other", color: "#ffffff", position: 30 },
    },
    { type: "tag.delete", tagId: otherId },
    { type: "tag.move", tagId: otherId, beforeId: null, afterId: null },
    { type: "item-view.set", itemId: otherId, primaryTagId: f.original[1].id },
  ]) {
    const other = outboxEntrySchema.parse({
      ...f.child,
      entityKey:
        command.type === "item-view.set"
          ? `item-view:${otherId}`
          : `tag:${otherId}`,
      sequence: 3,
      dependencies: [],
      operation: {
        ...f.child.operation,
        operationId: crypto.randomUUID(),
        command,
      },
    })
    expect(() =>
      captureTagOrderResolutionSnapshot({
        ...f.capture,
        entries: [...f.capture.entries, other],
      })
    ).toThrow("another unresolved personal")
  }
})
test("unconfirmed external prerequisites and dependents are never silently detached", () => {
  const f = tagOrderResolutionFixture(),
    id = crypto.randomUUID()
  const other = outboxEntrySchema.parse({
    ...f.child,
    entityKey: `item:${id}`,
    sequence: 3,
    dependencies: [f.child.operation.operationId],
    operation: {
      ...f.child.operation,
      operationId: crypto.randomUUID(),
      command: { type: "plan.set-status", itemId: id, status: "in_progress" },
    },
  })
  expect(() =>
    captureTagOrderResolutionSnapshot({
      ...f.capture,
      entries: [...f.capture.entries, other],
    })
  ).toThrow("external dependent")
  const prior = { ...other, sequence: 1, dependencies: [] },
    entry = {
      ...f.entry,
      sequence: 2,
      dependencies: [prior.operation.operationId],
    },
    child = { ...f.child, sequence: 3 }
  expect(() =>
    captureTagOrderResolutionSnapshot({
      ...f.capture,
      entries: [prior, entry, child],
      incident: { ...f.capture.incident, entry, intentions: [entry, child] },
    })
  ).toThrow("external prerequisite")
})
test("independent item content intentions do not enlarge the order review", () => {
  const f = tagOrderResolutionFixture(),
    id = crypto.randomUUID(),
    other = outboxEntrySchema.parse({
      ...f.child,
      entityKey: `item:${id}`,
      sequence: 3,
      dependencies: [],
      operation: {
        ...f.child.operation,
        operationId: crypto.randomUUID(),
        command: { type: "plan.set-status", itemId: id, status: "completed" },
      },
    })
  expect(
    captureTagOrderResolutionSnapshot({
      ...f.capture,
      entries: [...f.capture.entries, other],
    })
  ).toEqual(f.snapshot)
})
test("order capture preserves transitive ACK DTO evidence but does not claim it proves a remote receipt", () => {
  const f = tagOrderResolutionFixture(),
    first = {
      ...f.entry,
      state: "acknowledged" as const,
      sequence: 1,
      dependencies: [],
      operation: { ...f.entry.operation, operationId: crypto.randomUUID() },
    },
    second = {
      ...first,
      sequence: 2,
      dependencies: [first.operation.operationId],
      operation: { ...first.operation, operationId: crypto.randomUUID() },
    }
  const entry = {
      ...f.entry,
      sequence: 3,
      dependencies: [second.operation.operationId],
    },
    child = { ...f.child, sequence: 4 }
  const current = captureTagOrderResolutionSnapshot({
    ...f.capture,
    entries: [first, second, entry, child],
    incident: { ...f.capture.incident, entry, intentions: [entry, child] },
  })
  expect(current.acknowledgedDependencies).toEqual([first, second])
  expect(() =>
    validateTagOrderResolutionSnapshot(
      { ...current, acknowledgedDependencies: [second] },
      f.actor
    )
  ).toThrow()
})
test("a later observed shadow is allowed but a missing newer conflict observation or contradictory revision is rejected", () => {
  const f = tagOrderResolutionFixture(),
    newer = { ...f.observed[0], revision: 3, position: 1200 }
  const incident = structuredClone(f.capture.incident)
  incident.remote = [
    { entityKey: f.entry.entityKey, record: { store: "tags", record: newer } },
  ]
  expect(
    captureTagOrderResolutionSnapshot({
      ...f.capture,
      incident,
      observedTags: [newer, ...f.observed.slice(1)],
    }).observedTags.find((tag) => tag.id === newer.id)?.revision
  ).toBe(3)
  expect(() =>
    captureTagOrderResolutionSnapshot({
      ...f.capture,
      observedTags: [{ ...f.observed[0], revision: 1 }, ...f.observed.slice(1)],
    })
  ).toThrow()
  const bad = structuredClone(f.snapshot)
  const remote = bad.observedTags.find((tag) => tag.id === f.original[0].id)
  if (!remote) throw new Error("Order fixture remote is missing")
  remote.color = "#ffffff"
  expect(() => validateTagOrderResolutionSnapshot(bad, f.actor)).toThrow()
})
test("order capture does not resurrect tombstones or infer permission from missing primary", () => {
  const f = tagOrderResolutionFixture()
  expect(() =>
    captureTagOrderResolutionSnapshot({
      ...f.capture,
      localTags: f.local.map((tag, index) =>
        index === 1 ? { ...tag, deletedAt: f.now } : tag
      ),
    })
  ).toThrow("resurrect")
  expect(() =>
    captureTagOrderResolutionSnapshot({
      ...f.capture,
      localTags: f.local.slice(1),
    })
  ).toThrow("primary")
  const remote = { ...f.observed[0], deletedAt: f.now, revision: 3 },
    incident = structuredClone(f.capture.incident)
  incident.remote = [
    { entityKey: f.entry.entityKey, record: { store: "tags", record: remote } },
  ]
  expect(
    captureTagOrderResolutionSnapshot({
      ...f.capture,
      incident,
      observedTags: [remote, ...f.observed.slice(1)],
    }).observedTags.find((tag) => tag.id === remote.id)?.deletedAt
  ).toBe(f.now)
})

test("order capture rejects oversized catalogs and intentions instead of truncating them", () => {
  const f = tagOrderResolutionFixture()
  expect(() =>
    captureTagOrderResolutionSnapshot({
      ...f.capture,
      localTags: Array.from({ length: 10001 }, () => f.local[0]),
    })
  ).toThrow()
  expect(() =>
    captureTagOrderResolutionSnapshot({
      ...f.capture,
      entries: Array.from({ length: 10001 }, () => f.entry),
    })
  ).toThrow()
})
