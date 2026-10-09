import { expect, test } from "bun:test"
import { readMixedSyncQueueSummary } from "@/features/sync/mixed-sync-summary"
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
