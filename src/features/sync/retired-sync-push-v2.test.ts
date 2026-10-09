import "server-only"

import { expect, test } from "bun:test"
import { syncProtocolHeader } from "@/config/sync-protocol"
import {
  type SyncCoordinatorPortsV2,
  SyncCoordinatorV2,
} from "@/features/sync/coordinator-v2"
import { createHttpSyncTransportV2 } from "@/features/sync/http-transport-v2"
import { rejectRetiredSyncPushV2 } from "@/features/sync/retired-sync-push-v2"
import { encodeSyncProtocolRange } from "@/lib/sync/sync-protocol"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { remotePushResultV2Schema } from "@/schemas/remote-push-v2"

const actor = "retired-mixed-push-owner"
const requestHeaders = new Headers({ cookie: "opaque-test-session" })
function input() {
  return {
    transportVersion: 2,
    expectedUserId: actor,
    operations: [
      {
        operationId: crypto.randomUUID(),
        protocolVersion: 1,
        baseRevision: 7,
        command: { type: "tag.delete", tagId: crypto.randomUUID() },
      },
    ],
  }
}

test("mixed retirement authenticates exact headers and validates the envelope without executing intentions", async () => {
  const request = input()
  const before = structuredClone(request)
  for (const userId of [null, "", " ", "x".repeat(129), actor, "foreign"]) {
    const result = await rejectRetiredSyncPushV2(request, requestHeaders, {
      readSession: async (headers) => {
        expect(headers).toBe(requestHeaders)
        return userId === null ? null : { user: { id: userId } }
      },
    })
    expect(result).toEqual({
      transportVersion: 2,
      status:
        userId === actor
          ? "update_required"
          : userId === "foreign"
            ? "account_changed"
            : "unauthorized",
    })
    expect(remotePushResultV2Schema.parse(result)).toEqual(result)
  }
  expect(request).toEqual(before)
  const ports = { readSession: async () => ({ user: { id: actor } }) }
  for (const valid of [
    request,
    {
      ...request,
      transportVersion: 3,
      operations: [
        {
          ...request.operations[0],
          protocolVersion: 99,
          command: { type: "future.command", data: "preserved" },
        },
      ],
    },
  ]) {
    const original = structuredClone(valid)
    expect(await rejectRetiredSyncPushV2(valid, requestHeaders, ports)).toEqual(
      { transportVersion: 2, status: "update_required" }
    )
    expect(valid).toEqual(original)
  }
  for (const invalid of [
    null,
    {},
    { ...request, injected: true },
    { ...request, operations: [] },
    { ...request, operations: [request.operations[0], request.operations[0]] },
    {
      ...request,
      operations: [{ ...request.operations[0], baseRevision: -1 }],
    },
  ])
    expect(
      await rejectRetiredSyncPushV2(invalid, requestHeaders, ports)
    ).toEqual({ transportVersion: 2, status: "invalid_batch" })
})

test("mixed retirement sanitizes authentication failures without an outcome or secret details", async () => {
  const failure = await rejectRetiredSyncPushV2(input(), requestHeaders, {
    readSession: async () => {
      throw new Error("private token user@example.test")
    },
  }).catch((error: unknown) => error)
  expect(failure).toBeInstanceOf(Error)
  const error = failure as Error
  expect(error.message).toBe("Sync authentication is temporarily unavailable")
  expect(error.cause).toBeUndefined()
  expect(error.stack).not.toContain("user@example.test")
})

test("captured identity and pull two cannot ACK through retirement and release only their own lease", async () => {
  const request = input()
  const operation = request.operations[0]
  const entry = outboxEntrySchema.parse({
    userId: actor,
    entityKey: `tag:${operation.command.tagId}`,
    operation,
    sequence: 8,
    state: "pending",
    attempts: 0,
    lease: null,
    dependencies: [],
    createdAt: "2026-10-09T00:00:00.000Z",
  })
  const intention = structuredClone(entry.operation)
  const cursor = { key: "pull-cursor" as const, after: 7, through: null }
  const history = [{ operationId: crypto.randomUUID(), sequence: 7 }]
  const before = structuredClone({ cursor, history })
  let version = 2,
    applied = 0
  const calls: string[] = []
  const transport = createHttpSyncTransportV2(
    actor,
    (value) =>
      rejectRetiredSyncPushV2(value, requestHeaders, {
        readSession: async (headers) => {
          expect(headers).toBe(requestHeaders)
          calls.push("retired-session")
          return { user: { id: actor } }
        },
      }),
    (async (path, options) => {
      expect(options?.credentials).toBe("same-origin")
      const identity = String(path) === "/api/sync/identity"
      calls.push(identity ? `identity-${version}` : `pull-${version}`)
      return Response.json(
        identity
          ? { userId: actor }
          : {
              version: 2,
              changes: [],
              nextAfter: 7,
              through: 7,
              hasMore: false,
            },
        { headers: { [syncProtocolHeader]: encodeSyncProtocolRange(version) } }
      )
    }) as typeof fetch
  )
  const ports: SyncCoordinatorPortsV2 = {
    ...transport,
    isActive: async () => true,
    readCursor: async () => structuredClone(cursor),
    recoverExpiredSends: async () => undefined,
    readQueueState: async () => ({
      entries: [structuredClone(entry)],
      items: [],
    }),
    claim: async (id, sender) => {
      expect(id).toBe(operation.operationId)
      calls.push("claim")
      entry.state = "sending"
      entry.attempts++
      entry.lease = { ownerId: sender, expiresAt: "2099-10-09T00:00:00.000Z" }
      return structuredClone(entry)
    },
    release: async (id, sender) => {
      expect(id).toBe(operation.operationId)
      if (!entry.lease) throw new Error("Expected the sender's claimed lease")
      expect(sender).toBe(entry.lease.ownerId)
      calls.push("release")
      entry.state = "pending"
      entry.lease = null
    },
    applyPage: async () => undefined,
    applyResult: async () => {
      applied++
      throw new Error("Retirement must not ACK")
    },
  }
  const coordinator = new SyncCoordinatorV2(actor, ports)
  const result = await coordinator.run()
  expect(result.status).toBe("update_required")
  expect([result.uploaded, result.downloaded, applied]).toEqual([0, 0, 0])
  expect(calls).toEqual([
    "identity-2",
    "pull-2",
    "claim",
    "retired-session",
    "release",
  ])
  expect(entry.operation).toEqual(intention)
  expect(entry.dependencies).toEqual([])
  expect(entry.state).toBe("pending")
  expect(entry.lease).toBeNull()
  expect(entry.attempts).toBe(1)
  expect({ cursor, history }).toEqual(before)
  version = 3
  const blocked = await coordinator.run()
  expect(blocked.status).toBe("update_required")
  expect(calls.at(-1)).toBe("identity-3")
  expect(entry.attempts).toBe(1)
  expect(entry.operation).toEqual(intention)
  expect(applied).toBe(0)
  expect({ cursor, history }).toEqual(before)
})
