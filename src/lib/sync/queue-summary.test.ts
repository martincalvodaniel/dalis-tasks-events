import { expect, test } from "bun:test"
import { summarizeSyncQueue } from "@/lib/sync/queue-summary"
import type { OutboxEntry } from "@/types/local-sync"

const userId = "queue-test"
const timestamp = "2026-10-08T00:00:00.000Z"
function entry(
  sequence: number,
  state: OutboxEntry["state"] = "pending"
): OutboxEntry {
  const itemId = crypto.randomUUID()
  return {
    userId,
    entityKey: `item:${itemId}`,
    sequence,
    state,
    attempts: 0,
    dependencies: [],
    createdAt: timestamp,
    lease:
      state === "sending"
        ? { ownerId: crypto.randomUUID(), expiresAt: timestamp }
        : null,
    operation: {
      protocolVersion: 1,
      operationId: crypto.randomUUID(),
      baseRevision: 0,
      command: {
        type: "item.create",
        itemId,
        input: {
          kind: "task",
          title: "Test",
          description: "",
          scheduledDate: "2026-10-08",
          status: "not_started",
          checklist: [],
          recurrence: null,
        },
      },
    },
  }
}
function summary(entries: OutboxEntry[]) {
  return summarizeSyncQueue({ userId, entries, items: [] })
}

test("queue summaries exclude acknowledgements and distinguish every unconfirmed state", () => {
  const ready = entry(1)
  const waiting = entry(2)
  waiting.dependencies = [ready.operation.operationId]
  const unsupported = entry(3)
  const tagId = crypto.randomUUID()
  unsupported.entityKey = `tag:${tagId}`
  unsupported.operation.command = { type: "tag.delete", tagId }
  const blocked = entry(4)
  blocked.dependencies = [unsupported.operation.operationId]
  const entries = [
    ready,
    waiting,
    unsupported,
    blocked,
    entry(5, "sending"),
    entry(6, "conflict"),
    entry(7, "rejected"),
    entry(8, "acknowledged"),
  ]
  const before = JSON.stringify(entries)
  expect(summary(entries)).toEqual({
    pending: 4,
    ready: 1,
    waiting: 1,
    blocked: 1,
    unsupported: 1,
    sending: 1,
    conflicts: 1,
    rejected: 1,
  })
  expect(JSON.stringify(entries)).toBe(before)
})

test("dependency failures propagate while acknowledged dependencies become ready", () => {
  const root = entry(1, "conflict")
  const first = entry(2)
  const second = entry(3)
  first.dependencies = [root.operation.operationId]
  second.dependencies = [first.operation.operationId]
  expect(summary([second, root, first]).blocked).toBe(2)
  root.state = "acknowledged"
  const result = summary([second, root, first])
  expect(result.ready).toBe(1)
  expect(result.waiting).toBe(1)
})

test("missing dependencies, cycles and their descendants remain blocked", () => {
  const first = entry(1)
  const second = entry(2)
  const descendant = entry(3)
  const missing = entry(4)
  first.dependencies = [second.operation.operationId]
  second.dependencies = [first.operation.operationId]
  descendant.dependencies = [first.operation.operationId]
  missing.dependencies = [crypto.randomUUID()]
  expect(summary([first, second, descendant, missing]).blocked).toBe(4)
  expect(summary([]).pending).toBe(0)
})

test("long unordered dependency chains avoid recursive traversal", () => {
  const entries = Array.from({ length: 1500 }, (_, index) => entry(index + 1))
  for (let index = 1; index < entries.length; index++)
    entries[index].dependencies = [entries[index - 1].operation.operationId]
  const result = summary(entries.reverse())
  expect(result.ready).toBe(1)
  expect(result.waiting).toBe(1499)
  expect(result.blocked).toBe(0)
})

test("foreign accounts and duplicate queue identities cannot produce a summary", () => {
  const own = entry(1)
  expect(() => summary([{ ...own, userId: "other" }])).toThrow()
  expect(() => summary([own, own])).toThrow()
  expect(() => summary([own, { ...entry(2), sequence: 1 }])).toThrow()
})
