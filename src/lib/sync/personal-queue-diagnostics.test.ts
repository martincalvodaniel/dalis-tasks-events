import { expect, test } from "bun:test"
import { applyItemCommand } from "@/lib/calendar/item-command"
import { diagnosePersonalQueue } from "@/lib/sync/personal-queue-diagnostics"
import type { OutboxEntry } from "@/types/local-sync"
import type { SyncCommand } from "@/types/sync"

const userId = "personal-queue-owner"
const timestamp = "2026-10-09T00:00:00.000Z"
function entry(
  sequence: number,
  command: SyncCommand,
  state: OutboxEntry["state"] = "pending",
  parents: OutboxEntry[] = []
): OutboxEntry {
  const entityKey =
    "tagId" in command && command.type.startsWith("tag.")
      ? `tag:${command.tagId}`
      : command.type === "item-view.set"
        ? `item-view:${command.itemId}`
        : "itemId" in command
          ? `item:${command.itemId}`
          : ""
  return {
    userId,
    entityKey,
    sequence,
    state,
    attempts: state === "sending" ? 1 : 0,
    dependencies: parents.map((parent) => parent.operation.operationId),
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
function content(sequence: number, state: OutboxEntry["state"] = "pending") {
  return entry(
    sequence,
    {
      type: "item.create",
      itemId: crypto.randomUUID(),
      input: {
        kind: "task",
        title: "Own task",
        description: "",
        scheduledDate: "2026-10-09",
        status: "not_started",
        checklist: [],
        recurrence: null,
      },
    },
    state
  )
}
function move(sequence: number, state: OutboxEntry["state"] = "pending") {
  const value = entry(
    sequence,
    {
      type: "task.move",
      itemId: crypto.randomUUID(),
      occurrenceId: null,
      scope: "overdue",
      date: "2026-10-09",
      tagId: null,
      beforeId: null,
      afterId: null,
    },
    state
  )
  if (value.operation.command.type !== "task.move")
    throw new Error("Expected move")
  // Historical recurring movements can use their preserved content entity identity.
  value.operation.command.occurrenceId = `${value.operation.command.itemId}:2026-10-09`
  return value
}
function tag(
  sequence: number,
  parents: OutboxEntry[] = [],
  state: OutboxEntry["state"] = "pending"
) {
  return entry(
    sequence,
    { type: "tag.delete", tagId: crypto.randomUUID() },
    state,
    parents
  )
}
function view(sequence: number, parent: OutboxEntry) {
  return entry(
    sequence,
    {
      type: "item-view.set",
      itemId:
        "itemId" in parent.operation.command
          ? parent.operation.command.itemId
          : crypto.randomUUID(),
      primaryTagId: null,
    },
    "pending",
    [parent]
  )
}
function diagnose(entries: OutboxEntry[]) {
  return diagnosePersonalQueue({ userId, entries, items: [] })
}

test("a preserved move blocks tag and view descendants while independent own content remains ready", () => {
  const original = move(1)
  const category = tag(2, [original])
  const assignment = view(3, category)
  const independent = content(4)
  const input = [assignment, independent, original, category]
  const before = structuredClone(input)
  const value = diagnose(input)
  expect(value.operations.map((operation) => operation.category)).toEqual([
    "unsupported",
    "blocked",
    "blocked",
    "ready",
  ])
  expect(value.operations[2].blockingOperationIds).toEqual([
    category.operation.operationId,
  ])
  expect(
    value.ready.map((operation) => operation.entry.operation.operationId)
  ).toEqual([independent.operation.operationId])
  expect(
    value.personalProjectionBlockers.map(
      (operation) => operation.operation.operationId
    )
  ).toEqual([
    original.operation.operationId,
    category.operation.operationId,
    assignment.operation.operationId,
  ])
  expect(value.personalProjectionBlocked).toBe(true)
  value.operations[0].entry.operation.baseRevision = 100
  value.operations[1].entry.dependencies.pop()
  expect(input).toEqual(before)
})

test("create to view waits until the exact parent is acknowledged, without treating local capability as authorization", () => {
  const creation = content(1)
  const assignment = view(2, creation)
  let value = diagnose([creation, assignment])
  expect(value.operations.map((operation) => operation.category)).toEqual([
    "ready",
    "waiting",
  ])
  expect(value.operations[1].waitingOperationIds).toEqual([
    creation.operation.operationId,
  ])
  expect(value.operations[1].capability.contextKnown).toBe(false)
  expect(value.operations[1].capability.requiresRemoteValidation).toBe(true)
  creation.state = "acknowledged"
  value = diagnose([assignment, creation])
  expect(value.operations.map((operation) => operation.category)).toEqual([
    "settled",
    "ready",
  ])
  assignment.state = "acknowledged"
  expect(diagnose([creation, assignment]).personalProjectionBlocked).toBe(false)
})

test("content conflicts and superseded parents block personal dependents without inventing an ACK", () => {
  for (const state of ["conflict", "rejected", "superseded"] as const) {
    const parent = content(1, state)
    const assignment = view(2, parent)
    const value = diagnose([parent, assignment])
    expect(value.blocked).toHaveLength(2)
    expect(value.operations[1].blockingOperationIds).toEqual([
      parent.operation.operationId,
    ])
    expect(value.personalProjectionBlockers).toEqual([assignment])
    expect(value.settled).toHaveLength(0)
  }
  const parent = tag(1, [], "superseded")
  expect(diagnose([parent]).personalProjectionBlocked).toBe(false)
  const child = tag(2, [parent])
  expect(diagnose([parent, child]).personalProjectionBlockers).toEqual([child])
})

test("a tag before a move stays ready but the unresolved personal history prevents reconciliation everywhere", () => {
  const first = tag(1)
  const original = move(2)
  original.dependencies = [first.operation.operationId]
  const assignment = view(3, first)
  const value = diagnose([first, original, assignment])
  expect(value.operations.map((operation) => operation.category)).toEqual([
    "ready",
    "unsupported",
    "waiting",
  ])
  expect(value.personalProjectionBlockers).toHaveLength(3)
  expect(value.personalProjectionBlocked).toBe(true)
})

test("unsupported moves in flight or rejected remain preserved blockers and only ACK satisfies a dependency", () => {
  for (const state of [
    "pending",
    "sending",
    "conflict",
    "rejected",
    "superseded",
    "acknowledged",
  ] as const) {
    const original = move(1, state)
    const category = tag(2, [original])
    const value = diagnose([original, category])
    expect(value.operations[1].category).toBe(
      state === "acknowledged" ? "ready" : "blocked"
    )
    expect(value.operations[0].capability.supported).toBe(false)
    expect(
      value.personalProjectionBlockers.some(
        (operation) =>
          operation.operation.operationId === original.operation.operationId
      )
    ).toBe(state !== "acknowledged" && state !== "superseded")
    expect(original.state).toBe(state)
  }
})

test("known series and birthdays are unsupported without blocking separate content branches", () => {
  const known = content(1)
  if (known.operation.command.type !== "item.create")
    throw new Error("Expected create")
  const item = applyItemCommand(
    null,
    known.operation.command,
    userId,
    timestamp
  )
  if (item.kind !== "task") throw new Error("Expected task")
  item.recurrence = {
    frequency: "daily",
    interval: 1,
    anchorDate: "2026-10-09",
    timeZone: "Europe/Madrid",
    end: { type: "never" },
  }
  const update = entry(1, {
    type: "item.update",
    itemId: item.id,
    input: { ...known.operation.command.input },
  })
  const independent = content(2)
  const value = diagnosePersonalQueue({
    userId,
    entries: [update, independent],
    items: [item],
  })
  expect(value.unsupported).toHaveLength(1)
  expect(
    value.ready.map((operation) => operation.entry.operation.operationId)
  ).toEqual([independent.operation.operationId])
  expect(value.personalProjectionBlocked).toBe(false)
})

test("the complete queue rejects foreign, future, duplicate or missing dependency data before classification", () => {
  const first = content(1)
  const child = view(2, first)
  for (const input of [
    { userId, entries: [child], items: [] },
    { userId, entries: [first, { ...child, userId: "foreign" }], items: [] },
    { userId, entries: [first, { ...child, sequence: 1 }], items: [] },
    {
      userId,
      entries: [
        first,
        {
          ...child,
          operation: {
            ...child.operation,
            operationId: first.operation.operationId,
          },
        },
      ],
      items: [],
    },
    {
      userId,
      entries: [
        { ...first, dependencies: [child.operation.operationId] },
        child,
      ],
      items: [],
    },
    {
      userId,
      entries: [
        { ...first, operation: { ...first.operation, protocolVersion: 2 } },
      ],
      items: [],
    },
    {
      userId,
      entries: [
        {
          ...first,
          operation: {
            ...first.operation,
            command: { type: "future.command" },
          },
        },
      ],
      items: [],
    },
    { userId, entries: [{ ...first, extra: true }], items: [] },
    { userId, entries: [first], items: [], extra: true },
  ])
    expect(() => diagnosePersonalQueue(input)).toThrow()
  if (first.operation.command.type !== "item.create")
    throw new Error("Expected create")
  const item = applyItemCommand(
    null,
    first.operation.command,
    "foreign",
    timestamp
  )
  expect(() =>
    diagnosePersonalQueue({ userId, entries: [first], items: [item] })
  ).toThrow("another account")
  expect(() =>
    diagnosePersonalQueue({
      userId,
      entries: [],
      items: [
        { ...item, ownerId: userId },
        { ...item, ownerId: userId },
      ],
    })
  ).toThrow("duplicate")
})

test("a complete ten thousand intention chain preserves direct blockers without expanding all ancestors or truncating history", () => {
  const entries = [move(1)]
  for (let index = 1; index < 10000; index++)
    entries.push(tag(index + 1, [entries[index - 1]]))
  const value = diagnose(entries)
  expect(value.operations).toHaveLength(10000)
  expect(value.personalProjectionBlockers).toHaveLength(10000)
  expect(value.blocked).toHaveLength(9999)
  expect(value.operations.at(-1)?.blockingOperationIds).toEqual([
    entries[9998].operation.operationId,
  ])
  expect(
    value.operations.reduce(
      (sum, operation) => sum + operation.blockingOperationIds.length,
      0
    )
  ).toBe(9999)
  expect(() => diagnose([...entries, tag(10001, [entries[9999]])])).toThrow()
})
