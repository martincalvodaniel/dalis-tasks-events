import { expect, test } from "bun:test"
import {
  readMixedSyncQueueSummary,
  readPlacementSyncQueueSummary,
} from "@/features/sync/mixed-sync-summary"
import { applyItemCommand } from "@/lib/calendar/item-command"
import type { OutboxEntry } from "@/types/local-sync"

const identity = { userId: "mixed-summary-account", epoch: "current-epoch" }
function pendingTag(): OutboxEntry {
  const tagId = crypto.randomUUID()
  return {
    userId: identity.userId,
    entityKey: `tag:${tagId}`,
    sequence: 1,
    state: "pending",
    dependencies: [],
    attempts: 0,
    createdAt: "2026-10-09T00:00:00.000Z",
    lease: null,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 0,
      command: { type: "tag.delete", tagId },
    },
  }
}

test("mixed summary preserves personal intentions and closes after both account guards", async () => {
  const events: string[] = []
  const state = { entries: [pendingTag()], items: [] }
  const before = structuredClone(state)
  const summary = await readMixedSyncQueueSummary(identity, {
    requireActive: async (account) => {
      expect(account).toEqual(identity)
      events.push("guard")
    },
    openStore: async (userId) => {
      expect(userId).toBe(identity.userId)
      events.push("open")
      return {
        readQueueState: async () => {
          events.push("read")
          return state
        },
        close: () => events.push("close"),
      }
    },
  })
  expect(summary).toMatchObject({
    pending: 1,
    ready: 1,
    personalUnresolved: 1,
    personalProjectionBlocked: true,
  })
  expect(state).toEqual(before)
  expect(events).toEqual(["guard", "open", "read", "guard", "close"])
})

test("account changes prevent returning a stale summary without closing a foreign store", async () => {
  for (const failureAt of [1, 2]) {
    let guards = 0
    let opened = 0
    let closed = 0
    await expect(
      readMixedSyncQueueSummary(identity, {
        requireActive: async () => {
          if (++guards === failureAt) throw new Error("Account changed")
        },
        openStore: async () => {
          opened++
          return {
            readQueueState: async () => ({ entries: [], items: [] }),
            close: () => {
              closed++
            },
          }
        },
      })
    ).rejects.toThrow("Account changed")
    expect(opened).toBe(failureAt === 1 ? 0 : 1)
    expect(closed).toBe(opened)
  }
})

test("a caller identity mutation cannot retarget the captured account during an asynchronous guard", async () => {
  const input = { ...identity }
  const guarded: (typeof identity)[] = []
  const opened: string[] = []
  await readMixedSyncQueueSummary(input, {
    requireActive: async (account) => {
      guarded.push({ ...account })
      input.userId = "foreign-account"
      input.epoch = "foreign-epoch"
    },
    openStore: async (userId) => {
      opened.push(userId)
      return {
        readQueueState: async () => ({ entries: [], items: [] }),
        close: () => undefined,
      }
    },
  })
  expect(guarded).toEqual([identity, identity])
  expect(opened).toEqual([identity.userId])
})

test("foreign or failed stored snapshots never return counts and still close owned resources", async () => {
  for (const failure of ["foreign", "read"]) {
    let closed = 0
    await expect(
      readMixedSyncQueueSummary(identity, {
        requireActive: async () => undefined,
        openStore: async () => ({
          readQueueState: async () => {
            if (failure === "read") throw new Error("Snapshot failed")
            return {
              entries: [{ ...pendingTag(), userId: "foreign-account" }],
              items: [],
            }
          },
          close: () => {
            closed++
          },
        }),
      })
    ).rejects.toThrow()
    expect(closed).toBe(1)
  }
})

test("prepared placement summary uses generation-three policy without rewriting blocked historical intentions", async () => {
  const itemId = crypto.randomUUID()
  const item = applyItemCommand(
    null,
    {
      type: "item.create",
      itemId,
      input: {
        kind: "task",
        title: "Task",
        description: "",
        scheduledDate: "2026-10-09",
        status: "not_started",
        checklist: [],
        recurrence: null,
      },
    },
    identity.userId,
    "2026-10-09T00:00:00.000Z"
  )
  const entry = pendingTag()
  entry.entityKey = `task-placement:${JSON.stringify([itemId, "day", "2026-10-09"])}`
  entry.operation.command = {
    type: "task.move",
    itemId,
    occurrenceId: null,
    scope: "day",
    date: "2026-10-09",
    tagId: null,
    beforeId: null,
    afterId: null,
  }
  const state = { entries: [entry], items: [item] }
  const before = structuredClone(state)
  let closes = 0
  const ports = {
    requireActive: async () => undefined,
    openStore: async () => ({
      readQueueState: async () => state,
      close: () => {
        closes++
      },
    }),
  }
  expect(await readMixedSyncQueueSummary(identity, ports)).toMatchObject({
    ready: 0,
    unsupported: 1,
    personalProjectionBlocked: true,
  })
  expect(await readPlacementSyncQueueSummary(identity, ports)).toMatchObject({
    ready: 1,
    unsupported: 0,
    personalProjectionBlocked: true,
  })
  expect(closes).toBe(2)
  expect(state).toEqual(before)
})
