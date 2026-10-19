import { expect, test } from "bun:test"
import { placementResolutionFixture } from "@/lib/backup/placement-resolution-fixture"
import {
  capturePlacementResolutionSnapshot,
  validatePlacementResolutionSnapshot,
} from "@/lib/sync/placement-resolution"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { overduePlacementDate } from "@/schemas/ordering"
import { placementResolutionCaptureSchema } from "@/schemas/placement-resolution"
import { planVariantSchema } from "@/schemas/plan-item"

for (const variant of planVariantSchema.options)
  test(`${variant} captures an immutable exact simple placement chain with independent revisions`, () => {
    const f = placementResolutionFixture(undefined, variant),
      before = JSON.stringify(f.capture),
      snapshot = capturePlacementResolutionSnapshot(f.capture)
    expect(snapshot.incident.intentions).toEqual([f.entry, f.child])
    expect(
      snapshot.local.placements.find(
        (record) => record.occurrenceId === f.items[0].id
      )?.position
    ).toBe(3072)
    expect(
      snapshot.observed.placements.find(
        (record) => record.occurrenceId === f.items[0].id
      )?.revision
    ).toBe(2)
    expect(
      snapshot.observed.placements
        .filter((record) => record.occurrenceId !== f.items[0].id)
        .every((record) => record.revision === 1)
    ).toBe(true)
    expect(snapshot.acknowledgedDependencies).toEqual([])
    expect(validatePlacementResolutionSnapshot(snapshot, f.actor)).toEqual(
      snapshot
    )
    expect(JSON.stringify(f.capture)).toBe(before)
  })
test("overdue uses the declared civil day and canonical storage date without reading a clock", () => {
  const f = placementResolutionFixture(undefined, "appointment", "overdue")
  expect(
    f.snapshot.observed.placements.every(
      (record) => record.date === overduePlacementDate
    )
  ).toBe(true)
  expect(f.entry.operation.command).toMatchObject({ date: "2026-10-19" })
  expect(() =>
    capturePlacementResolutionSnapshot({
      ...f.capture,
      local: {
        ...f.local,
        placements: f.local.placements.map((record) => ({
          ...record,
          date: f.date,
        })),
      },
    })
  ).toThrow()
})
test("catalog enumeration is canonical but intentions retain exact history order", () => {
  const f = placementResolutionFixture(),
    reverse = (catalog: typeof f.local) => ({
      ...catalog,
      items: catalog.items.toReversed(),
      views: catalog.views.toReversed(),
      placements: catalog.placements.toReversed(),
    })
  expect(
    capturePlacementResolutionSnapshot({
      ...f.capture,
      local: reverse(f.local),
      observed: reverse(f.observed),
    })
  ).toEqual(f.snapshot)
  expect(() =>
    validatePlacementResolutionSnapshot(
      {
        ...f.snapshot,
        incident: { ...f.snapshot.incident, intentions: [f.child, f.entry] },
      },
      f.actor
    )
  ).toThrow()
})
test("missing, duplicate, foreign, uncommitted and unreviewed catalog records are rejected", () => {
  const f = placementResolutionFixture()
  for (const change of [
    {
      ...f.capture,
      observed: { ...f.observed, placements: f.observed.placements.slice(1) },
    },
    {
      ...f.capture,
      local: {
        ...f.local,
        placements: [...f.local.placements, f.local.placements[0]],
      },
    },
    {
      ...f.capture,
      observed: { ...f.observed, items: [...f.items, f.items[0]] },
    },
    {
      ...f.capture,
      local: {
        ...f.local,
        views: f.local.views.map((view) => ({ ...view, userId: "foreign" })),
      },
    },
    {
      ...f.capture,
      local: {
        ...f.local,
        placements: f.local.placements.map((record) => ({
          ...record,
          revision: 0,
        })),
      },
    },
    {
      ...f.capture,
      observed: {
        ...f.observed,
        items: f.items.map((item) => ({ ...item, title: "Unreviewed" })),
      },
    },
    { ...f.capture, observed: { ...f.observed, views: [] } },
    { ...f.capture, userId: "foreign" },
  ])
    expect(() => capturePlacementResolutionSnapshot(change)).toThrow()
  expect(() =>
    validatePlacementResolutionSnapshot(f.snapshot, "foreign")
  ).toThrow()
  expect(
    placementResolutionCaptureSchema.safeParse({ ...f.capture, repair: true })
      .success
  ).toBe(false)
  expect(
    placementResolutionCaptureSchema.safeParse({
      ...f.capture,
      entries: Array(10001).fill(f.entry),
    }).success
  ).toBe(false)
})
test("uncertain, disconnected, omitted or mixed-group intentions cannot be superseded", () => {
  const f = placementResolutionFixture()
  for (const entries of [
    [f.entry],
    [f.entry, { ...f.child, attempts: 1 }],
    [f.entry, { ...f.child, dependencies: [] }],
    [{ ...f.entry, state: "pending" }, f.child],
    [{ ...f.entry, attempts: 0 }, f.child],
    [f.entry, f.child, f.child],
  ])
    expect(() =>
      capturePlacementResolutionSnapshot({ ...f.capture, entries })
    ).toThrow()
  for (const command of [
    { ...f.child.operation.command, tagId: crypto.randomUUID() },
    {
      ...f.child.operation.command,
      occurrenceId: `${f.items[0].id}:2026-10-18`,
    },
    { ...f.child.operation.command, date: "2026-10-20" },
  ]) {
    const child = {
      ...f.child,
      operation: { ...f.child.operation, command },
    }
    expect(() =>
      capturePlacementResolutionSnapshot({
        ...f.capture,
        entries: [f.entry, child],
        incident: { ...f.capture.incident, intentions: [f.entry, child] },
      })
    ).toThrow()
  }
})
test("another unresolved operation is protected even without a dependency edge", () => {
  const f = placementResolutionFixture(),
    other = outboxEntrySchema.parse({
      ...f.child,
      sequence: 3,
      dependencies: [],
      entityKey: `item:${f.items[1].id}`,
      operation: {
        ...f.child.operation,
        operationId: crypto.randomUUID(),
        command: {
          type: "plan.set-status",
          itemId: f.items[1].id,
          status: "completed",
        },
      },
    })
  expect(() =>
    capturePlacementResolutionSnapshot({
      ...f.capture,
      entries: [f.entry, f.child, other],
    })
  ).toThrow("another unresolved")
  expect(() =>
    capturePlacementResolutionSnapshot({
      ...f.capture,
      entries: [
        f.entry,
        f.child,
        { ...other, dependencies: [f.entry.operation.operationId] },
      ],
    })
  ).toThrow()
})
test("external ACK prerequisites are captured transitively without claiming that DTOs prove remote application", () => {
  const f = placementResolutionFixture(),
    ack = outboxEntrySchema.parse({
      ...f.entry,
      state: "acknowledged",
      sequence: 1,
      operation: { ...f.entry.operation, operationId: crypto.randomUUID() },
    }),
    root = {
      ...f.entry,
      sequence: 2,
      dependencies: [ack.operation.operationId],
    },
    child = { ...f.child, sequence: 3 }
  const capture = {
    ...f.capture,
    entries: [ack, root, child],
    incident: { ...f.capture.incident, entry: root, intentions: [root, child] },
  }
  const snapshot = capturePlacementResolutionSnapshot(capture)
  expect(snapshot.acknowledgedDependencies).toEqual([ack])
  expect(() =>
    capturePlacementResolutionSnapshot({
      ...capture,
      entries: [{ ...ack, state: "pending" }, root, child],
    })
  ).toThrow()
  expect(() =>
    validatePlacementResolutionSnapshot(
      { ...snapshot, acknowledgedDependencies: [] },
      f.actor
    )
  ).toThrow()
})
test("primary and frozen observations must match, while a genuinely later remote shadow is not called an ancestor", () => {
  const f = placementResolutionFixture(),
    remote = { ...f.observed.placements[0], revision: 3, position: 2560 }
  const snapshot = capturePlacementResolutionSnapshot({
    ...f.capture,
    observed: {
      ...f.observed,
      placements: [remote, ...f.observed.placements.slice(1)],
    },
    incident: {
      ...f.capture.incident,
      remote: [
        {
          entityKey: f.entry.entityKey,
          record: { store: "taskPlacements", record: remote },
        },
      ],
    },
  })
  expect(snapshot.incident.shadowAtOutcome).toEqual(f.outcome.base)
  expect(
    snapshot.observed.placements.find(
      (record) => record.occurrenceId === remote.occurrenceId
    )
  ).toEqual(remote)
  for (const observation of [
    { ...remote, revision: 1 },
    { ...remote, revision: 2 },
  ])
    expect(() =>
      capturePlacementResolutionSnapshot({
        ...f.capture,
        observed: {
          ...f.observed,
          placements: [observation, ...f.observed.placements.slice(1)],
        },
        incident: {
          ...f.capture.incident,
          remote: [
            {
              entityKey: f.entry.entityKey,
              record: { store: "taskPlacements", record: observation },
            },
          ],
        },
      })
    ).toThrow()
  expect(() =>
    validatePlacementResolutionSnapshot(
      {
        ...f.snapshot,
        incident: { ...f.snapshot.incident, localAtOutcome: [] },
      },
      f.actor
    )
  ).toThrow()
})
test("cross-date/group, recurrence, restoration and unknown primary remain outside this initial contract", () => {
  const f = placementResolutionFixture()
  for (const local of [
    {
      ...f.local,
      placements: f.local.placements.map((record, index) =>
        index === 0 ? { ...record, date: "2026-10-17" } : record
      ),
    },
    {
      ...f.local,
      placements: f.local.placements.map((record, index) =>
        index === 1 ? { ...record, tagId: crypto.randomUUID() } : record
      ),
    },
  ])
    expect(() =>
      capturePlacementResolutionSnapshot({ ...f.capture, local })
    ).toThrow()
  const items = f.items.map((item, index) =>
    index === 0
      ? {
          ...item,
          recurrence: {
            frequency: "daily",
            interval: 1,
            anchorDate: "2026-10-18",
            timeZone: "Europe/Madrid",
            end: { type: "never" },
          },
        }
      : item
  )
  expect(() =>
    capturePlacementResolutionSnapshot({
      ...f.capture,
      local: { ...f.local, items },
      observed: { ...f.observed, items },
    })
  ).toThrow()
  expect(() =>
    capturePlacementResolutionSnapshot({
      ...f.capture,
      observed: {
        ...f.observed,
        placements: f.observed.placements.map((record, index) =>
          index === 1 ? { ...record, deletedAt: f.now } : record
        ),
      },
    })
  ).toThrow()
})

test("placement comparison refuses over-budget snapshots before any future persistence", () => {
  const f = placementResolutionFixture(),
    items = Array.from({ length: 800 }, () => ({
      ...f.items[0],
      id: crypto.randomUUID(),
      description: "x".repeat(8000),
    }))
  expect(() =>
    validatePlacementResolutionSnapshot(
      {
        ...f.snapshot,
        local: { ...f.local, items },
        observed: { ...f.observed, items },
      },
      f.actor
    )
  ).toThrow("byte limit")
})

test("a simple primary cannot recover a group containing a recurring peer", () => {
  const f = placementResolutionFixture(),
    items = f.items.map((item, index) =>
      index === 1
        ? {
            ...item,
            recurrence: {
              frequency: "daily",
              interval: 1,
              anchorDate: "2026-10-18",
              timeZone: "Europe/Madrid",
              end: { type: "never" },
            },
          }
        : item
    )
  expect(() =>
    capturePlacementResolutionSnapshot({
      ...f.capture,
      local: { ...f.local, items },
      observed: { ...f.observed, items },
    })
  ).toThrow("group containing recurring")
})
