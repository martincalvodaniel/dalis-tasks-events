import { expect, test } from "bun:test"
import {
  placementSyncProtocolVersion,
  syncOperationVersion,
  syncProtocolHeader,
  syncProtocolVersion,
} from "@/config/sync-protocol"
import { createHttpSyncTransport } from "@/features/sync/http-transport"
import {
  createHttpSyncTransportForProtocol,
  createHttpSyncTransportV2,
} from "@/features/sync/http-transport-v2"
import { createHttpSyncTransportV3 } from "@/features/sync/http-transport-v3"
import { encodeSyncProtocolRange } from "@/lib/sync/sync-protocol"
import { overduePlacementDate } from "@/schemas/ordering"
import type { RemotePreferenceEffects } from "@/types/preference-effects"
import type { RemoteChangesPageV2 } from "@/types/remote-changes-page-v2"
import type {
  RemotePushInputV2,
  RemotePushResultV2,
} from "@/types/remote-push-v2"

const userId = "placement-transport-owner"
const itemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const peerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const tagId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const operationId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const timestamp = "2026-10-09T00:00:00.000Z"

function requestInput(): RemotePushInputV2 {
  return {
    transportVersion: 2,
    expectedUserId: userId,
    operations: [
      {
        protocolVersion: 1,
        operationId,
        baseRevision: 1,
        command: {
          type: "task.move",
          itemId,
          occurrenceId: null,
          scope: "overdue",
          date: "2026-10-10",
          tagId,
          afterId: peerId,
          beforeId: null,
        },
      },
    ],
  }
}
function effects(): RemotePreferenceEffects {
  const metadata = {
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  return {
    version: 1,
    userId,
    operationId,
    sequence: 7,
    effects: [
      {
        store: "taskPlacements",
        record: {
          ...metadata,
          userId,
          occurrenceId: itemId,
          scope: "overdue",
          date: overduePlacementDate,
          tagId,
          position: 0,
          revision: 2,
        },
      },
      {
        store: "taskPlacements",
        record: {
          ...metadata,
          userId,
          occurrenceId: peerId,
          scope: "overdue",
          date: overduePlacementDate,
          tagId,
          position: -1024,
          revision: 3,
        },
      },
      {
        store: "itemViews",
        record: {
          ...metadata,
          userId,
          itemId,
          primaryTagId: tagId,
          revision: 5,
        },
      },
    ],
  }
}
function page(): RemoteChangesPageV2 {
  return {
    version: 2,
    changes: [
      {
        version: 2,
        kind: "preference",
        recipientUserId: userId,
        operationId,
        sequence: 7,
        effects: effects(),
      },
    ],
    nextAfter: 7,
    through: 7,
    hasMore: false,
  }
}
function reply(): RemotePushResultV2 {
  return {
    transportVersion: 2,
    status: "complete",
    results: [
      {
        kind: "preference",
        outcome: { operationId, status: "applied", effects: effects() },
      },
    ],
  }
}
function fakeFetch(
  handle: (path: string, options?: RequestInit) => Promise<Response>
): typeof fetch {
  return (async (path, options) =>
    handle(String(path), options)) as typeof fetch
}
function response(body: unknown, version: number) {
  return Response.json(body, {
    headers: { [syncProtocolHeader]: encodeSyncProtocolRange(version) },
  })
}

test("exclusive version-three negotiation leaves legacy defaults intact and rejects cross-version responses before JSON", async () => {
  expect(syncProtocolVersion).toBe(1)
  expect(syncOperationVersion).toBe(1)
  expect(placementSyncProtocolVersion).toBe(3)
  for (const [clientVersion, serverVersion] of [
    [3, 2],
    [2, 3],
    [3, 1],
    [1, 3],
  ] as const) {
    let reads = 0
    const fetchRequest = fakeFetch(async () => {
      const value = response({ invalid: true }, serverVersion)
      value.json = async () => {
        reads++
        throw new Error("Incompatible transport must not inspect payloads")
      }
      return value
    })
    const transport =
      clientVersion === 3
        ? createHttpSyncTransportV3(userId, async () => null, fetchRequest)
        : clientVersion === 2
          ? createHttpSyncTransportV2(userId, async () => null, fetchRequest)
          : createHttpSyncTransport(userId, async () => null, fetchRequest)
    await expect(transport.readIdentity()).rejects.toMatchObject({
      reason: "update_required",
    })
    const query = { after: 6, through: 7, limit: 3 }
    const pull =
      clientVersion === 1
        ? createHttpSyncTransport(userId, async () => null, fetchRequest).pull({
            key: "pull-cursor",
            after: query.after,
            through: query.through,
          })
        : createHttpSyncTransportForProtocol(
            clientVersion,
            userId,
            async () => null,
            fetchRequest
          ).pull(query)
    await expect(pull).rejects.toMatchObject({
      reason: "update_required",
    })
    expect(reads).toBe(0)
    expect(query).toEqual({ after: 6, through: 7, limit: 3 })
  }
})

test("a captured version-two identity cannot authorize parsing a version-three pull, or vice versa", async () => {
  for (const identityVersion of [2, 3] as const) {
    let identityReads = 0,
      pageReads = 0
    const fetchRequest = fakeFetch(async (path) => {
      const identity = path === "/api/sync/identity"
      const value = response(
        identity ? { userId } : page(),
        identity ? identityVersion : identityVersion === 2 ? 3 : 2
      )
      value.json = async () => {
        if (identity) {
          identityReads++
          return { userId }
        }
        pageReads++
        throw new Error("Deployment changed before page reception")
      }
      return value
    })
    const transport =
      identityVersion === 2
        ? createHttpSyncTransportV2(userId, async () => null, fetchRequest)
        : createHttpSyncTransportV3(userId, async () => null, fetchRequest)
    expect(await transport.readIdentity()).toBe(userId)
    await expect(
      transport.pull({ after: 6, through: 7, limit: 3 })
    ).rejects.toMatchObject({ reason: "update_required" })
    expect(identityReads).toBe(1)
    expect(pageReads).toBe(0)
  }
})

test("version-three transport preserves complete placement DTOs, version-two envelopes and version-one intentions", async () => {
  const input = requestInput()
  const before = structuredClone(input)
  const received: unknown[] = []
  const transport = createHttpSyncTransportV3(
    userId,
    async (request) => {
      received.push(request)
      return reply()
    },
    fakeFetch(async (path, options) => {
      expect(options?.credentials).toBe("same-origin")
      expect(options?.cache).toBe("no-store")
      expect(options?.signal).toBeInstanceOf(AbortSignal)
      if (path === "/api/sync/identity") return response({ userId }, 3)
      expect(
        Object.fromEntries(new URL(path, "https://example.test").searchParams)
      ).toEqual({
        after: "6",
        through: "7",
        limit: "3",
        expectedUserId: userId,
      })
      return response(page(), 3)
    })
  )
  expect(await transport.readIdentity()).toBe(userId)
  expect(await transport.pull({ after: 6, through: 7, limit: 3 })).toEqual(
    page()
  )
  expect(await transport.push(input)).toEqual(reply())
  expect(received).toEqual([before])
  expect(received[0]).not.toBe(input)
  expect(input).toEqual(before)
  await expect(
    transport.push({ ...input, expectedUserId: "other" })
  ).rejects.toMatchObject({ reason: "account_changed" })
  expect(received).toHaveLength(1)
})

test("version-three reception retains strict account and checkpoint validation and rejects unsupported kernel versions", async () => {
  const valid = page()
  const foreign = structuredClone(valid)
  const change = foreign.changes[0]
  if (change.kind !== "preference")
    throw new Error("Expected personal change fixture")
  change.effects.effects[0].record.userId = "foreign"
  for (const invalid of [
    foreign,
    { ...valid, through: 8, hasMore: true },
    { ...valid, version: 3 },
  ]) {
    const transport = createHttpSyncTransportV3(
      userId,
      async () => null,
      fakeFetch(async () => response(invalid, 3))
    )
    await expect(
      transport.pull({ after: 6, through: 7, limit: 3 })
    ).rejects.toThrow()
  }
  for (const invalid of [1, 5, NaN, 2.5])
    expect(() =>
      createHttpSyncTransportForProtocol(
        invalid as 2 | 3,
        userId,
        async () => null
      )
    ).toThrow("Invalid mixed sync transport protocol")
  expect(() => createHttpSyncTransportV3("", async () => null)).toThrow()
})
