import { expect, test } from "bun:test"
import {
  projectSyncIncidentOverview,
  projectSyncIncidentSnapshot,
} from "@/lib/sync/incident-snapshot"
import type { Task } from "@/types/calendar-item"
import type {
  LocalOperationOutcomeV2,
  LocalPreferenceOutcomeV2,
} from "@/types/local-operation-outcome-v2"
import type { OutboxEntry } from "@/types/local-sync"
import type { RemoteShadowV2 } from "@/types/remote-shadow-v2"

function fixture() {
  const userId = "snapshot-test"
  const now = "2026-10-08T00:00:00.000Z"
  const item: Task = {
    id: crypto.randomUUID(),
    ownerId: userId,
    kind: "task",
    title: "Later draft",
    description: "",
    scheduledDate: "2026-10-08",
    status: "not_started",
    checklist: [],
    recurrence: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: now,
    revision: 1,
  }
  const entry: OutboxEntry = {
    userId,
    entityKey: `item:${item.id}`,
    operation: {
      protocolVersion: 1,
      operationId: crypto.randomUUID(),
      baseRevision: 1,
      command: { type: "item.delete", itemId: item.id },
    },
    sequence: 1,
    dependencies: [],
    state: "conflict",
    attempts: 1,
    createdAt: now,
    lease: null,
  }
  const dependent: OutboxEntry = {
    ...entry,
    operation: { ...entry.operation, operationId: crypto.randomUUID() },
    sequence: 2,
    dependencies: [entry.operation.operationId],
    state: "pending",
    attempts: 0,
  }
  const remote = { ...item, title: "Remote tombstone", revision: 2 }
  return {
    userId,
    entries: [dependent, entry],
    items: [item],
    shadows: [{ entityKey: entry.entityKey, record: remote }],
    outcomes: [
      {
        key: `operation-outcome:${entry.operation.operationId}`,
        operation: entry.operation,
        result: {
          status: "conflict" as const,
          operationId: entry.operation.operationId,
          current: remote,
        },
        local: item,
        base: remote,
      },
    ],
  }
}

test("incident snapshot retains pending chains and tombstones in sequence without mutating evidence", () => {
  const input = fixture()
  const before = JSON.stringify(input)
  const [incident] = projectSyncIncidentSnapshot(input)
  expect(incident.local?.deletedAt).toBeTruthy()
  expect(incident.remote?.deletedAt).toBeTruthy()
  expect(incident.intentions.map((entry) => entry.sequence)).toEqual([1, 2])
  expect(incident.intentions[1].dependencies).toEqual([
    incident.entry.operation.operationId,
  ])
  expect(JSON.stringify(input)).toBe(before)
})

test("snapshot excludes acknowledged intentions and includes rejected incidents without remote data", () => {
  const input = fixture()
  input.entries[0].state = "acknowledged"
  const [incident] = projectSyncIncidentSnapshot(input)
  expect(incident.intentions).toHaveLength(1)
  const entry = { ...input.entries[1], state: "rejected" }
  const rejected = projectSyncIncidentSnapshot({
    ...input,
    entries: [entry],
    shadows: [],
    outcomes: [
      {
        ...input.outcomes[0],
        result: {
          status: "unavailable",
          operationId: entry.operation.operationId,
        },
        base: null,
      },
    ],
  })
  expect(rejected[0].remote).toBeNull()
  expect(rejected[0].reason).toBe("unavailable")
  expect(
    projectSyncIncidentSnapshot({
      userId: input.userId,
      entries: [],
      items: [],
      shadows: [],
      outcomes: [],
    })
  ).toEqual([])
})

test("snapshot rejects foreign partitions, duplicates and incomplete outcomes as a whole", () => {
  const input = fixture()
  for (const invalid of [
    { ...input, userId: "other" },
    { ...input, entries: [...input.entries, input.entries[0]] },
    {
      ...input,
      entries: [input.entries[0], { ...input.entries[1], sequence: 2 }],
    },
    { ...input, items: [...input.items, input.items[0]] },
    { ...input, items: [{ ...input.items[0], ownerId: "other" }] },
    { ...input, shadows: [...input.shadows, input.shadows[0]] },
    {
      ...input,
      shadows: [
        {
          ...input.shadows[0],
          record: { ...input.shadows[0].record, ownerId: "other" },
        },
      ],
    },
    { ...input, outcomes: [] },
    { ...input, outcomes: [...input.outcomes, input.outcomes[0]] },
  ])
    expect(() => projectSyncIncidentSnapshot(invalid)).toThrow()
})

test("snapshot identifies related unconfirmed intentions outside an item before offering choices", () => {
  const input = fixture()
  const root = input.entries[1]
  const linked: OutboxEntry = {
    ...input.entries[0],
    entityKey: `item-view:${input.items[0].id}`,
    sequence: 3,
    operation: {
      ...input.entries[0].operation,
      operationId: crypto.randomUUID(),
      command: {
        type: "item-view.set",
        itemId: input.items[0].id,
        primaryTagId: null,
      },
    },
    dependencies: [root.operation.operationId],
  }
  expect(
    projectSyncIncidentSnapshot({
      ...input,
      entries: [...input.entries, linked],
    })[0].blockedByRelatedIntentions
  ).toBe(true)
  expect(
    projectSyncIncidentSnapshot({
      ...input,
      entries: [...input.entries, { ...linked, state: "acknowledged" }],
    })[0].blockedByRelatedIntentions
  ).toBe(false)
})

function mixedFixture() {
  const value = fixture()
  const itemId = value.items[0].id
  const entry: OutboxEntry = {
    ...value.entries[1],
    entityKey: `item-view:${itemId}`,
    sequence: 3,
    operation: {
      protocolVersion: 1,
      operationId: crypto.randomUUID(),
      baseRevision: 1,
      command: { type: "item-view.set", itemId, primaryTagId: null },
    },
    dependencies: [value.entries[1].operation.operationId],
    state: "rejected",
  }
  const view = {
    userId: value.userId,
    itemId,
    primaryTagId: null,
    revision: 0,
    createdAt: value.items[0].createdAt,
    updatedAt: value.items[0].updatedAt,
    deletedAt: null,
  }
  const base = { store: "itemViews" as const, record: { ...view, revision: 5 } }
  const outcome: LocalPreferenceOutcomeV2 = {
    version: 2,
    kind: "preference",
    key: `operation-outcome:${entry.operation.operationId}`,
    operation: structuredClone(entry.operation),
    result: {
      kind: "preference",
      outcome: {
        operationId: entry.operation.operationId,
        status: "unavailable",
      },
    },
    local: [
      {
        entityKey: entry.entityKey,
        record: { store: "itemViews", record: view },
      },
    ],
    base: [{ entityKey: entry.entityKey, record: base }],
  }
  const shadows: RemoteShadowV2[] = [
    { ...value.shadows[0], version: 2, kind: "item" },
    {
      version: 2,
      kind: "preference",
      entityKey: entry.entityKey,
      record: structuredClone(base),
    },
  ]
  const outcomes: LocalOperationOutcomeV2[] = [
    {
      ...value.outcomes[0],
      version: 2,
      kind: "item",
      result: { kind: "item", outcome: value.outcomes[0].result },
    },
    outcome,
  ]
  return {
    ...value,
    entries: [...value.entries, entry],
    tags: [],
    itemViews: [view],
    shadows,
    outcomes,
  }
}

test("mixed incidents route explicit families while preserving the complete cross-domain graph", () => {
  const input = mixedFixture()
  const before = structuredClone(input)
  const overview = projectSyncIncidentOverview(input)
  expect(overview.map((value) => value.kind)).toEqual(["item", "preference"])
  if (overview[0].kind !== "item" || overview[1].kind !== "preference")
    throw new Error("Expected mixed incidents")
  expect(overview[0].incident.blockedByRelatedIntentions).toBe(true)
  expect(overview[1].incident.local[0].record?.record.revision).toBe(0)
  expect(overview[1].incident.remote[0].record?.record.revision).toBe(5)
  expect(
    overview[1].incident.intentions.map((entry) => entry.sequence)
  ).toEqual([3])
  const { tags, itemViews, ...legacyInput } = input
  const items = projectSyncIncidentSnapshot(legacyInput)
  expect(items).toHaveLength(1)
  expect(items[0].blockedByRelatedIntentions).toBe(true)
  overview[1].incident.entry.state = "pending"
  expect(input).toEqual(before)
})

test("personal late conflict replay preserves newer observed bases without asserting ancestry", () => {
  const input = mixedFixture()
  const outcome = input.outcomes[1]
  if (outcome.kind !== "preference")
    throw new Error("Expected preference outcome")
  const entry = input.entries[2]
  entry.state = "conflict"
  const base = outcome.base[0].record
  if (base?.store !== "itemViews") throw new Error("Expected observed view")
  outcome.result.outcome = {
    operationId: entry.operation.operationId,
    status: "conflict",
    current: { ...base, record: { ...base.record, revision: 2 } },
  }
  const [_, projected] = projectSyncIncidentOverview(input)
  if (projected.kind !== "preference")
    throw new Error("Expected personal incident")
  expect(projected.incident.remote[0].record?.record.revision).toBe(5)
  expect(projected.incident.outcome.result.outcome.status).toBe("conflict")
  expect(projected.incident.entry.operation.baseRevision).toBe(1)
  const remote = input.shadows[1]
  if (remote.kind !== "preference") throw new Error("Expected personal shadow")
  remote.record.record.revision = 4
  expect(() => projectSyncIncidentOverview(input)).toThrow("regress")
  remote.record.record.revision = 5
  if (remote.record.store !== "itemViews") throw new Error("Expected item view")
  remote.record.record.primaryTagId = crypto.randomUUID()
  expect(() => projectSyncIncidentOverview(input)).toThrow("contradictory")
})

test("all mixed evidence rejects corruption before returning even item-only snapshots", () => {
  const input = mixedFixture()
  const { tags, itemViews, ...itemOnly } = input
  for (const invalid of [
    { ...itemOnly, shadows: [...input.shadows, input.shadows[1]] },
    {
      ...itemOnly,
      shadows: [...input.shadows, { ...input.shadows[1], version: 3 }],
    },
    { ...itemOnly, outcomes: [...input.outcomes, input.outcomes[1]] },
    { ...itemOnly, outcomes: [input.outcomes[0]] },
    {
      ...itemOnly,
      outcomes: [input.outcomes[0], { ...input.outcomes[1], version: 3 }],
    },
    {
      ...itemOnly,
      entries: input.entries.map((entry, index) =>
        index === 2 ? { ...entry, userId: "foreign" } : entry
      ),
    },
  ])
    expect(() => projectSyncIncidentSnapshot(invalid)).toThrow()
  for (const invalid of [
    { ...input, itemViews: [...input.itemViews, input.itemViews[0]] },
    { ...input, itemViews: [{ ...input.itemViews[0], userId: "foreign" }] },
  ])
    expect(() => projectSyncIncidentOverview(invalid)).toThrow()
  const acknowledged = structuredClone(input)
  acknowledged.entries[2].state = "acknowledged"
  expect(() => projectSyncIncidentOverview(acknowledged)).toThrow("state")
  const changed = structuredClone(input)
  changed.entries[2].operation.baseRevision = 99
  expect(() => projectSyncIncidentOverview(changed)).toThrow("frozen")
})
