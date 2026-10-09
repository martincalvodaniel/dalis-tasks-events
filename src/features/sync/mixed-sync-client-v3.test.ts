import { expect, test } from "bun:test"
import type { MixedClientPorts } from "@/features/sync/mixed-sync-client-core"
import { createMixedSyncClientV3 } from "@/features/sync/mixed-sync-client-v3"
import { SyncTransportError } from "@/features/sync/transport-error"
import { summarizeSyncQueueV2 } from "@/lib/sync/queue-summary-v2"
import { encodeSyncProtocolRange } from "@/lib/sync/sync-protocol"
import type { RemotePushResultV2 } from "@/types/remote-push-v2"

const identity = {
  userId: "placement-client-owner",
  epoch: crypto.randomUUID(),
}
const summary = summarizeSyncQueueV2({
  userId: identity.userId,
  entries: [],
  items: [],
})
const settled = {
  status: "settled" as const,
  uploaded: 0,
  downloaded: 0,
  diagnostics: null,
}
function ports(overrides: Partial<MixedClientPorts>): MixedClientPorts {
  return {
    requireActive: async () => undefined,
    readSummary: async () => summary,
    openRuntime: async () => ({
      run: async () => settled,
      close: async () => undefined,
    }),
    sendOperations: async () => {
      throw new Error("No push expected")
    },
    fetchRequest: fetch,
    ...overrides,
  }
}

test("prepared client captures account and uses only announcement 3 with envelopes 2 and intentions 1", async () => {
  const account = { ...identity }
  const events: string[] = []
  const operation = {
    operationId: crypto.randomUUID(),
    protocolVersion: 1 as const,
    baseRevision: 0,
    command: {
      type: "task.move" as const,
      itemId: crypto.randomUUID(),
      occurrenceId: null,
      scope: "day" as const,
      date: "2026-10-09",
      tagId: null,
      beforeId: null,
      afterId: null,
    },
  }
  const input = {
    transportVersion: 2 as const,
    expectedUserId: identity.userId,
    operations: [operation],
  }
  const reply: RemotePushResultV2 = {
    transportVersion: 2,
    status: "complete",
    results: [
      {
        kind: "preference",
        outcome: { operationId: operation.operationId, status: "unsupported" },
      },
    ],
  }
  const client = createMixedSyncClientV3(
    account,
    ports({
      readSummary: async (captured) => {
        expect(captured).toEqual(identity)
        return summary
      },
      requireActive: async (captured) => {
        expect(captured).toEqual(identity)
        events.push("guard")
      },
      openRuntime: async (captured, transport) => {
        expect(captured).toEqual(identity)
        events.push("open")
        return {
          run: async () => {
            expect(await transport.readIdentity()).toBe(identity.userId)
            expect(await transport.push(input)).toEqual(reply)
            events.push("run")
            return settled
          },
          close: async () => {
            events.push("close")
          },
        }
      },
      sendOperations: async (request) => {
        expect(request).toEqual(input)
        events.push("dispatch3")
        return reply
      },
      fetchRequest: (async (_path, options) => {
        expect(options?.credentials).toBe("same-origin")
        return Response.json(
          { userId: identity.userId },
          {
            headers: { "x-dalis-sync-protocol": encodeSyncProtocolRange(3) },
          }
        )
      }) as typeof fetch,
    })
  )
  account.userId = "changed-owner"
  account.epoch = crypto.randomUUID()
  expect(await client.readSummary()).toEqual(summary)
  const attempt = client.createAttempt(async () => {
    events.push("refresh")
  })
  const pending = attempt.run()
  expect(attempt.run()).toBe(pending)
  expect(await pending).toEqual(settled)
  expect(events).toEqual([
    "open",
    "dispatch3",
    "run",
    "guard",
    "refresh",
    "guard",
    "close",
  ])
})

test("older announcements fail before body or dispatch and close the captured runtime", async () => {
  for (const version of [1, 2]) {
    let bodyReads = 0,
      sends = 0,
      closes = 0,
      refreshes = 0
    const client = createMixedSyncClientV3(
      identity,
      ports({
        openRuntime: async (_captured, transport) => ({
          run: async () => {
            try {
              await transport.readIdentity()
              throw new Error("Old generation accepted")
            } catch (error) {
              expect(error).toBeInstanceOf(SyncTransportError)
              expect((error as SyncTransportError).reason).toBe(
                "update_required"
              )
              return { ...settled, status: "update_required" as const }
            }
          },
          close: async () => {
            closes++
          },
        }),
        sendOperations: async () => {
          sends++
          return undefined
        },
        fetchRequest: (async (_path, _options) => {
          const response = Response.json(
            { userId: identity.userId },
            {
              headers: {
                "x-dalis-sync-protocol": encodeSyncProtocolRange(version),
              },
            }
          )
          response.json = async () => {
            bodyReads++
            throw new Error("Body must not be read")
          }
          return response
        }) as typeof fetch,
      })
    )
    expect(
      (
        await client
          .createAttempt(async () => {
            refreshes++
          })
          .run()
      ).status
    ).toBe("update_required")
    expect({ bodyReads, sends, closes, refreshes }).toEqual({
      bodyReads: 0,
      sends: 0,
      closes: 1,
      refreshes: 1,
    })
  }
})

test("lost account during refresh cannot report success and closes once", async () => {
  for (const failedGuard of [1, 2]) {
    let guards = 0,
      closes = 0,
      refreshes = 0
    const client = createMixedSyncClientV3(
      identity,
      ports({
        requireActive: async () => {
          if (++guards === failedGuard) throw new Error("Account changed")
        },
        openRuntime: async () => ({
          run: async () => settled,
          close: async () => {
            closes++
          },
        }),
      })
    )
    await expect(
      client
        .createAttempt(async () => {
          refreshes++
        })
        .run()
    ).rejects.toThrow("Account changed")
    expect(closes).toBe(1)
    expect(refreshes).toBe(failedGuard === 1 ? 0 : 1)
  }
})

test("stop before opening prevents dispatch and refresh", async () => {
  let opened = 0,
    refreshed = 0
  const client = createMixedSyncClientV3(
    identity,
    ports({
      openRuntime: async () => {
        opened++
        throw new Error("Must not open")
      },
    })
  )
  const attempt = client.createAttempt(async () => {
    refreshed++
  })
  attempt.stop()
  expect((await attempt.run()).status).toBe("stopped")
  expect({ opened, refreshed }).toEqual({ opened: 0, refreshed: 0 })
})

test("invalid account identity fails before resources open", () => {
  expect(() => createMixedSyncClientV3({ ...identity, userId: "" })).toThrow()
  expect(() =>
    createMixedSyncClientV3({ ...identity, epoch: "invalid" })
  ).toThrow()
})
