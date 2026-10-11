import { expect, test } from "bun:test"
import {
  readMixedSyncQueueSummary,
  readPlacementSyncQueueSummary,
  readPlanSyncQueueSummary,
  readRecurringSyncQueueSummary,
} from "@/features/sync/mixed-sync-summary"
import { applyItemCommand } from "@/lib/calendar/item-command"
import { planSchema } from "@/schemas/plan-item"
import type { OutboxEntry } from "@/types/local-sync"

const identity = { userId: "mixed-summary-account", epoch: "current-epoch" }

test("recurring summary selects its policy and preserves historical missing-CAS intentions and dependent chains", async () => {
  const timestamp = "2026-10-11T13:00:00.000Z"
  const item = planSchema.parse({
    kind: "plan",
    variant: "note",
    id: crypto.randomUUID(),
    ownerId: identity.userId,
    title: "Series",
    description: "",
    status: "not_started",
    completedAt: null,
    checklist: [],
    schedule: {
      mode: "all_day",
      startDate: "2026-10-11",
      endDateExclusive: "2026-10-12",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-11",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  })
  const entry = pendingTag()
  entry.entityKey = `item:${item.id}`
  entry.operation.baseRevision = 1
  entry.operation.command = {
    type: "plan.set-occurrence-status",
    itemId: item.id,
    occurrenceId: `${item.id}:2026-10-11`,
    expectedOccurrenceRevision: 0,
    status: "completed",
  }
  const historical = structuredClone(entry)
  historical.operation.operationId = crypto.randomUUID()
  historical.sequence = 2
  const { expectedOccurrenceRevision, ...command } = entry.operation.command
  expect(expectedOccurrenceRevision).toBe(0)
  historical.operation.command = command
  historical.attempts = 1
  const dependent = structuredClone(entry)
  dependent.operation.operationId = crypto.randomUUID()
  dependent.sequence = 3
  dependent.dependencies = [historical.operation.operationId]
  const state = { entries: [entry, historical, dependent], items: [item] }
  const before = structuredClone(state),
    events: string[] = []
  const ports = {
    requireActive: async () => {
      events.push("guard")
    },
    openStore: async () => ({
      readQueueState: async () => state,
      close: () => {
        events.push("close")
      },
    }),
  }
  expect(await readPlanSyncQueueSummary(identity, ports)).toMatchObject({
    ready: 0,
    unsupported: 3,
  })
  expect(await readRecurringSyncQueueSummary(identity, ports)).toMatchObject({
    ready: 1,
    unsupported: 1,
  })
  expect(events).toEqual(["guard", "guard", "close", "guard", "guard", "close"])
  expect(state).toEqual(before)
  let guards = 0,
    closed = 0
  await expect(
    readRecurringSyncQueueSummary(identity, {
      requireActive: async () => {
        if (++guards === 2) throw new Error("Account changed")
      },
      openStore: async () => ({
        readQueueState: async () => state,
        close: () => {
          closed++
        },
      }),
    })
  ).rejects.toThrow("Account changed")
  expect(closed).toBe(1)
  expect(state).toEqual(before)
})
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
