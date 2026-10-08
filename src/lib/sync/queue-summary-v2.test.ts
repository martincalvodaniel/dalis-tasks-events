import { expect, test } from "bun:test"
import { summarizeSyncQueueV2 } from "@/lib/sync/queue-summary-v2"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import { syncQueueSummaryV2Schema } from "@/schemas/sync-queue-v2"
import type { OutboxEntry } from "@/types/local-sync"
import type { SyncCommand } from "@/types/sync"

const userId = "mixed-summary-owner"
const timestamp = "2026-10-09T00:00:00.000Z"
function entry(
  sequence: number,
  command: SyncCommand,
  dependencies: OutboxEntry[] = [],
  state: OutboxEntry["state"] = "pending"
): OutboxEntry {
  const entityKey =
    command.type === "task.move"
      ? taskPlacementEntityKey(
          command.occurrenceId ?? command.itemId,
          command.scope,
          command.date
        )
      : command.type === "item-view.set"
        ? `item-view:${command.itemId}`
        : "tagId" in command
          ? `tag:${command.tagId}`
          : "itemId" in command
            ? `item:${command.itemId}`
            : ""
  return {
    userId,
    entityKey,
    sequence,
    state,
    dependencies: dependencies.map((entry) => entry.operation.operationId),
    attempts: state === "sending" ? 1 : 0,
    createdAt: timestamp,
    lease:
      state === "sending"
        ? { ownerId: crypto.randomUUID(), expiresAt: timestamp }
        : null,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 0,
      command,
    },
  }
}
function tag(
  sequence: number,
  dependencies: OutboxEntry[] = [],
  state: OutboxEntry["state"] = "pending"
) {
  return entry(
    sequence,
    { type: "tag.delete", tagId: crypto.randomUUID() },
    dependencies,
    state
  )
}
function summary(entries: OutboxEntry[]) {
  return summarizeSyncQueueV2({ userId, entries, items: [] })
}

test("a historical move blocks personal descendants while independent content remains ready", () => {
  const move = entry(1, {
    type: "task.move",
    itemId: crypto.randomUUID(),
    occurrenceId: null,
    scope: "overdue",
    date: "2026-10-09",
    tagId: null,
    beforeId: null,
    afterId: null,
  })
  const dependent = tag(2, [move])
  const content = entry(3, { type: "item.delete", itemId: crypto.randomUUID() })
  const input = [move, dependent, content],
    before = structuredClone(input)
  expect(summary(input)).toEqual({
    pending: 3,
    ready: 1,
    waiting: 0,
    blocked: 1,
    unsupported: 1,
    sending: 0,
    conflicts: 0,
    rejected: 0,
    personalUnresolved: 2,
    personalProjectionBlocked: true,
  })
  expect(input).toEqual(before)
})

test("acknowledged parents unblock children, while superseded parents do not masquerade as ACKs", () => {
  const parent = tag(1, [], "acknowledged"),
    child = tag(2, [parent])
  expect(summary([parent, child])).toMatchObject({
    pending: 1,
    ready: 1,
    blocked: 0,
    personalUnresolved: 1,
    personalProjectionBlocked: true,
  })
  parent.state = "superseded"
  expect(summary([parent])).toMatchObject({
    pending: 0,
    personalUnresolved: 0,
    personalProjectionBlocked: false,
  })
  expect(summary([parent, child])).toMatchObject({
    ready: 0,
    blocked: 1,
    personalUnresolved: 1,
    personalProjectionBlocked: true,
  })
  parent.state = "pending"
  expect(summary([parent, child])).toMatchObject({
    ready: 1,
    waiting: 1,
    personalUnresolved: 2,
  })
})

test("personal sending, conflicts and rejections remain unresolved without being double-counted as pending", () => {
  const entries = [
    tag(1, [], "sending"),
    tag(2, [], "conflict"),
    tag(3, [], "rejected"),
    tag(4, [], "acknowledged"),
  ]
  expect(summary(entries)).toEqual({
    pending: 0,
    ready: 0,
    waiting: 0,
    blocked: 0,
    unsupported: 0,
    sending: 1,
    conflicts: 1,
    rejected: 1,
    personalUnresolved: 3,
    personalProjectionBlocked: true,
  })
  expect(summary([])).toMatchObject({
    pending: 0,
    personalUnresolved: 0,
    personalProjectionBlocked: false,
  })
})

test("complete graph and summary consistency are validated before returning any counts", () => {
  const parent = tag(1),
    child = tag(2, [parent])
  expect(() => summary([child])).toThrow()
  expect(() => summary([parent, { ...child, userId: "foreign" }])).toThrow()
  expect(() => summary([parent, { ...child, sequence: 1 }])).toThrow()
  const value = summary([parent, child])
  for (const invalid of [
    { ...value, personalProjectionBlocked: false },
    { ...value, personalUnresolved: 3 },
    { ...value, ready: 2 },
    { ...value, extra: true },
  ])
    expect(() => syncQueueSummaryV2Schema.parse(invalid)).toThrow()
  value.pending = 100
  expect(summary([parent, child]).pending).toBe(2)
})
