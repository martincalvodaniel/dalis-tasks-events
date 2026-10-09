import { expect, test } from "bun:test"
import { createMixedSyncClient } from "@/features/sync/mixed-sync-client"
import { SyncTransportError } from "@/features/sync/transport-error"
import { diagnosePersonalQueue } from "@/lib/sync/personal-queue-diagnostics"
import { summarizeSyncQueueV2 } from "@/lib/sync/queue-summary-v2"
import { encodeSyncProtocolRange } from "@/lib/sync/sync-protocol"

const identity = { userId: "mixed-client-owner", epoch: crypto.randomUUID() }
const summary = summarizeSyncQueueV2({
  userId: identity.userId,
  entries: [],
  items: [],
})
const diagnostics = diagnosePersonalQueue({
  userId: identity.userId,
  entries: [],
  items: [],
})
const settled = {
  status: "settled" as const,
  uploaded: 0,
  downloaded: 0,
  diagnostics,
}

test("composition binds the captured account to transport 2, summary and a coalesced closing attempt", async () => {
  const account = { ...identity }
  const events: string[] = []
  const fetched: {
    path: string
    credentials: RequestCredentials | undefined
  }[] = []
  const client = createMixedSyncClient(account, {
    requireActive: async (current) => {
      expect(current).toEqual(identity)
      events.push("guard")
    },
    readSummary: async (current) => {
      expect(current).toEqual(identity)
      return summary
    },
    openRuntime: async (current, transport) => {
      expect(current).toEqual(identity)
      events.push("open")
      return {
        run: async () => {
          expect(await transport.readIdentity()).toBe(identity.userId)
          events.push("run")
          return settled
        },
        close: async () => {
          events.push("close")
        },
      }
    },
    sendOperations: async () => {
      throw new Error("No push expected")
    },
    fetchRequest: (async (path, options) => {
      fetched.push({ path: String(path), credentials: options?.credentials })
      return Response.json(
        { userId: identity.userId },
        {
          headers: { "x-dalis-sync-protocol": encodeSyncProtocolRange(2) },
        }
      )
    }) as typeof fetch,
  })
  account.userId = "foreign-account"
  account.epoch = crypto.randomUUID()
  expect(await client.readSummary()).toEqual(summary)
  const attempt = client.createAttempt(async () => {
    events.push("refresh")
  })
  const work = attempt.run()
  expect(attempt.run()).toBe(work)
  expect(await work).toEqual(settled)
  expect(events).toEqual(["open", "run", "guard", "refresh", "guard", "close"])
  expect(fetched).toEqual([
    { path: "/api/sync/identity", credentials: "same-origin" },
  ])
})

test("loss of the account before or during refresh prevents success and closes its own runtime", async () => {
  for (const failedGuard of [1, 2]) {
    let guards = 0,
      refreshed = 0,
      closed = 0
    const client = createMixedSyncClient(identity, {
      requireActive: async () => {
        if (++guards === failedGuard) throw new Error("Account changed")
      },
      readSummary: async () => summary,
      openRuntime: async () => ({
        run: async () => settled,
        close: async () => {
          closed++
        },
      }),
      sendOperations: async () => {
        throw new Error("No push expected")
      },
      fetchRequest: fetch,
    })
    await expect(
      client
        .createAttempt(async () => {
          refreshed++
        })
        .run()
    ).rejects.toThrow("Account changed")
    expect(refreshed).toBe(failedGuard === 1 ? 0 : 1)
    expect(closed).toBe(1)
  }
})

test("a server still announcing transport 1 produces update_required without dispatching", async () => {
  let refreshed = 0,
    closed = 0,
    dispatched = 0
  const client = createMixedSyncClient(identity, {
    requireActive: async () => undefined,
    readSummary: async () => summary,
    openRuntime: async (_account, transport) => ({
      run: async () => {
        try {
          await transport.readIdentity()
          throw new Error("Legacy announcement unexpectedly accepted")
        } catch (error) {
          if (
            !(error instanceof SyncTransportError) ||
            error.reason !== "update_required"
          )
            throw error
          return { ...settled, status: "update_required", diagnostics: null }
        }
      },
      close: async () => {
        closed++
      },
    }),
    sendOperations: async () => {
      dispatched++
      return undefined
    },
    fetchRequest: (async (_path, _options) =>
      Response.json(
        { userId: identity.userId },
        {
          headers: { "x-dalis-sync-protocol": encodeSyncProtocolRange(1) },
        }
      )) as typeof fetch,
  })
  const result = await client
    .createAttempt(async () => {
      refreshed++
    })
    .run()
  expect(result.status).toBe("update_required")
  expect(result.diagnostics).toBeNull()
  expect(dispatched).toBe(0)
  // A finished pass may refresh its preserved local summary even when it requires an update.
  expect(refreshed).toBe(1)
  expect(closed).toBe(1)
})

test("invalid account identity fails before opening resources or requesting a summary", () => {
  for (const account of [
    { ...identity, userId: "" },
    { ...identity, epoch: "unknown-epoch" },
  ]) {
    expect(() => createMixedSyncClient(account)).toThrow()
  }
})
