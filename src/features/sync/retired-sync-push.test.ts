import "server-only"

import { expect, test } from "bun:test"
import { syncProtocolHeader } from "@/config/sync-protocol"
import {
  SyncCoordinator,
  type SyncCoordinatorPorts,
} from "@/features/sync/coordinator"
import { createHttpSyncTransport } from "@/features/sync/http-transport"
import { rejectRetiredSyncPush } from "@/features/sync/retired-sync-push"
import { encodeSyncProtocolRange } from "@/lib/sync/sync-protocol"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { remotePushResultSchema } from "@/schemas/remote-sync"

const actor = "retired-push-owner"
const timestamp = "2026-10-09T10:00:00.000Z"
const headers = new Headers({ cookie: "opaque-test-session" })
function input() {
  return {
    expectedUserId: actor,
    operations: [
      {
        operationId: crypto.randomUUID(),
        protocolVersion: 1,
        baseRevision: 7,
        command: { type: "item.delete", itemId: crypto.randomUUID() },
      },
    ],
  }
}

test("retired push derives identity from exact headers and rejects missing or invalid sessions", async () => {
  const request = input()
  const original = structuredClone(request)
  for (const identity of [
    null,
    "",
    " ",
    "x".repeat(129),
    actor,
    "other-owner",
  ]) {
    const result = await rejectRetiredSyncPush(request, headers, {
      readSession: async (received) => {
        expect(received).toBe(headers)
        return identity === null ? null : { user: { id: identity } }
      },
    })
    expect(result).toEqual({
      status:
        identity === actor
          ? "update_required"
          : identity === "other-owner"
            ? "account_changed"
            : "unauthorized",
    })
    expect(remotePushResultSchema.parse(result)).toEqual(result)
  }
  expect(request).toEqual(original)
  const nextHeaders = new Headers({ cookie: "new-session" })
  expect(
    await rejectRetiredSyncPush(request, nextHeaders, {
      readSession: async (received) => {
        expect(received).toBe(nextHeaders)
        return null
      },
    })
  ).toEqual({ status: "unauthorized" })
})

test("retirement validates only the shared envelope, retaining unknown future intentions unchanged", async () => {
  const request = input()
  const ports = { readSession: async () => ({ user: { id: actor } }) }
  for (const valid of [
    request,
    {
      ...request,
      operations: [
        {
          ...request.operations[0],
          protocolVersion: 2,
          command: {
            type: "future.operation",
            futureData: { untouched: true },
          },
        },
      ],
    },
  ]) {
    const original = structuredClone(valid)
    const result = await rejectRetiredSyncPush(valid, headers, ports)
    expect(result).toEqual({ status: "update_required" })
    expect(remotePushResultSchema.parse(result)).toEqual(result)
    expect(valid).toEqual(original)
  }
  for (const invalid of [
    null,
    {},
    { ...request, actor: "injected" },
    { ...request, operations: [] },
    { ...request, operations: [request.operations[0], request.operations[0]] },
    {
      ...request,
      operations: [{ ...request.operations[0], baseRevision: -1 }],
    },
    { ...request, operations: [{ ...request.operations[0], command: null }] },
  ])
    expect(await rejectRetiredSyncPush(invalid, headers, ports)).toEqual({
      status: "invalid_batch",
    })
})

test("authentication errors propagate without private details or fabricated results", async () => {
  let caught: unknown
  try {
    await rejectRetiredSyncPush(input(), headers, {
      readSession: async () => {
        throw new Error("private user@example.test token")
      },
    })
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(Error)
  expect((caught as Error).message).toBe(
    "Sync authentication is temporarily unavailable"
  )
  expect((caught as Error).cause).toBeUndefined()
  expect((caught as Error).stack).not.toContain("user@example.test")
})

test("a legacy HTTP handshake followed by retirement releases its lease without ACK or history changes", async () => {
  const request = input()
  const operation = request.operations[0]
  const entry = outboxEntrySchema.parse({
    userId: actor,
    entityKey: `item:${operation.command.itemId}`,
    operation,
    sequence: 8,
    state: "pending",
    attempts: 0,
    lease: null,
    dependencies: [],
    createdAt: timestamp,
  })
  const originalIntention = structuredClone({
    operation: entry.operation,
    dependencies: entry.dependencies,
    entityKey: entry.entityKey,
    sequence: entry.sequence,
  })
  const cursor = { key: "pull-cursor" as const, after: 7, through: null }
  const history = [
    { operationId: crypto.randomUUID(), status: "applied", sequence: 7 },
  ]
  const baseline = structuredClone({ cursor, history })
  const calls: string[] = []
  let appliedResults = 0
  const transport = createHttpSyncTransport(
    actor,
    async (value) =>
      rejectRetiredSyncPush(value, headers, {
        readSession: async (received) => {
          expect(received).toBe(headers)
          calls.push("retired-session")
          return { user: { id: actor } }
        },
      }),
    (async (path, options) => {
      expect(options?.credentials).toBe("same-origin")
      expect(options?.cache).toBe("no-store")
      const url = new URL(String(path), "https://example.test")
      const identity = url.pathname === "/api/sync/identity"
      calls.push(identity ? "identity-v1" : "pull-v1")
      if (!identity)
        expect(Object.fromEntries(url.searchParams)).toEqual({
          after: "7",
          limit: "50",
          expectedUserId: actor,
        })
      return Response.json(
        identity
          ? { userId: actor }
          : { changes: [], nextAfter: 7, through: 7, hasMore: false },
        {
          headers: { [syncProtocolHeader]: encodeSyncProtocolRange(1) },
        }
      )
    }) as typeof fetch
  )
  const ports: SyncCoordinatorPorts = {
    ...transport,
    isActive: async () => true,
    readCursor: async () => structuredClone(cursor),
    recoverExpiredSends: async () => undefined,
    listEntries: async () => [structuredClone(entry)],
    readItem: async () => null,
    applyPage: async (value) => {
      expect(value).toEqual({
        after: 7,
        page: { changes: [], nextAfter: 7, through: 7, hasMore: false },
      })
    },
    claim: async (id, sender) => {
      expect(id).toBe(operation.operationId)
      calls.push("claim")
      entry.state = "sending"
      entry.attempts++
      entry.lease = { ownerId: sender, expiresAt: timestamp }
      return structuredClone(entry)
    },
    release: async (id, sender) => {
      expect(id).toBe(operation.operationId)
      if (!entry.lease) throw new Error("Claimed lease is missing")
      expect(sender).toBe(entry.lease.ownerId)
      calls.push("release")
      entry.state = "pending"
      entry.lease = null
    },
    applyResult: async () => {
      appliedResults++
      throw new Error("Retirement must not ACK")
    },
  }
  expect(await new SyncCoordinator(actor, ports).run()).toEqual({
    status: "update_required",
    uploaded: 0,
    downloaded: 0,
  })
  expect(calls).toEqual([
    "identity-v1",
    "pull-v1",
    "claim",
    "retired-session",
    "release",
  ])
  expect(appliedResults).toBe(0)
  expect(entry.state).toBe("pending")
  expect(entry.lease).toBeNull()
  expect(entry.attempts).toBe(1)
  expect({
    operation: entry.operation,
    dependencies: entry.dependencies,
    entityKey: entry.entityKey,
    sequence: entry.sequence,
  }).toEqual(originalIntention)
  expect({ cursor, history }).toEqual(baseline)
})
