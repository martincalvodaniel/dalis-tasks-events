import { expect, test } from "bun:test"
import { projectSyncIncidentSnapshot } from "@/lib/sync/incident-snapshot"
import type { Task } from "@/types/calendar-item"
import type { OutboxEntry } from "@/types/local-sync"

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
