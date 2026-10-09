import "server-only"

import { expect, test } from "bun:test"
import {
  type AuthenticatedPushPortsV2,
  pushAuthenticatedSyncBatchV2,
} from "@/features/sync/authenticated-push-v2"
import { validateRemotePushResultV2 } from "@/lib/sync/remote-push-v2"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"
import type { SyncOperation } from "@/types/sync"

const actor = "authenticated-push-owner"
const timestamp = "2026-10-09T10:00:00.000Z"
function fixture() {
  const calls: string[] = []
  const headers = new Headers({
    cookie: "opaque-test-session",
    "x-request-marker": "first",
  })
  const operations: SyncOperation[] = [1, 2].map(() => ({
    operationId: crypto.randomUUID(),
    protocolVersion: 1,
    baseRevision: 0,
    command: { type: "tag.delete", tagId: crypto.randomUUID() },
  }))
  const input = {
    transportVersion: 2 as const,
    expectedUserId: actor,
    operations,
  }
  const outcome = (operation: SyncOperation): RemoteOperationResultV2 => {
    if (operation.command.type !== "tag.delete")
      throw new Error("Expected tag command")
    return {
      kind: "preference",
      outcome: {
        operationId: operation.operationId,
        status: "applied",
        effects: {
          version: 1,
          userId: actor,
          operationId: operation.operationId,
          sequence: operations.indexOf(operation) + 1,
          effects: [
            {
              store: "tags",
              record: {
                id: operation.command.tagId,
                userId: actor,
                name: "Work",
                normalizedName: "work",
                color: "#123456",
                position: 0,
                revision: 1,
                createdAt: timestamp,
                updatedAt: timestamp,
                deletedAt: timestamp,
              },
            },
          ],
        },
      },
    }
  }
  const ports: AuthenticatedPushPortsV2 = {
    readSession: async (requestHeaders) => {
      calls.push("session")
      expect(requestHeaders).toBe(headers)
      expect(requestHeaders.get("cookie")).toBe("opaque-test-session")
      return { user: { id: actor } }
    },
    readReadiness: async () => {
      calls.push("readiness")
      return { ready: true, missing: [], incompatible: [] }
    },
    execute: async (owner, operation) => {
      expect(owner).toBe(actor)
      calls.push(operation.operationId)
      const original = operations.find(
        (value) => value.operationId === operation.operationId
      )
      if (!original) throw new Error("Unexpected operation")
      expect(operation).toEqual(original)
      return outcome(original)
    },
  }
  return { calls, headers, operations, input, ports, outcome }
}

test("authenticated push derives actor from exact headers and checks readiness once for a batch", async () => {
  const f = fixture()
  const original = structuredClone(f.input)
  const result = await pushAuthenticatedSyncBatchV2(f.input, f.headers, f.ports)
  expect(result).toEqual({
    transportVersion: 2,
    status: "complete",
    results: f.operations.map(f.outcome),
  })
  expect(validateRemotePushResultV2(result, actor, f.input)).toEqual(result)
  expect(f.calls).toEqual([
    "session",
    "readiness",
    ...f.operations.map((operation) => operation.operationId),
  ])
  expect(f.input).toEqual(original)
  const secondHeaders = new Headers({ cookie: "new-session" })
  f.ports.readSession = async (headers) => {
    expect(headers).toBe(secondHeaders)
    return null
  }
  expect(
    await pushAuthenticatedSyncBatchV2(f.input, secondHeaders, f.ports)
  ).toEqual({ transportVersion: 2, status: "unauthorized" })
  expect(f.calls).toHaveLength(4)
})

test("null sessions and authentication errors cannot execute or leak private details", async () => {
  const f = fixture()
  f.ports.readSession = async () => null
  expect(
    await pushAuthenticatedSyncBatchV2(f.input, f.headers, f.ports)
  ).toEqual({ transportVersion: 2, status: "unauthorized" })
  f.ports.readSession = async () => {
    throw new Error("private user@example.test session")
  }
  await expect(
    pushAuthenticatedSyncBatchV2(f.input, f.headers, f.ports)
  ).rejects.toThrow("Sync authentication is temporarily unavailable")
  expect(f.calls).toEqual([])
})

test("injected actors, account switches and old or future envelopes fail before indexes", async () => {
  const f = fixture()
  const { transportVersion: _version, ...legacy } = f.input
  for (const [input, status] of [
    [{ ...f.input, expectedUserId: "other" }, "account_changed"],
    [{ ...f.input, actor: "injected" }, "invalid_batch"],
    [legacy, "update_required"],
    [{ ...f.input, transportVersion: 3 }, "update_required"],
    [
      { ...f.input, operations: [{ ...f.operations[0], protocolVersion: 2 }] },
      "update_required",
    ],
    [
      { ...f.input, operations: [{ ...f.operations[0], baseRevision: -1 }] },
      "invalid_batch",
    ],
  ] as const) {
    f.calls.length = 0
    expect(
      await pushAuthenticatedSyncBatchV2(input, f.headers, f.ports)
    ).toEqual({ transportVersion: 2, status })
    expect(f.calls).toEqual(["session"])
  }
})

test("readiness failure retries without execution and later failure preserves the validated prefix for replay", async () => {
  const f = fixture()
  f.ports.readReadiness = async () => {
    f.calls.push("readiness")
    return { ready: true, missing: [], incompatible: ["private-index"] }
  }
  expect(
    await pushAuthenticatedSyncBatchV2(f.input, f.headers, f.ports)
  ).toEqual({
    transportVersion: 2,
    status: "retry_later",
    results: [],
    failedOperationId: f.operations[0].operationId,
  })
  expect(f.calls).toEqual(["session", "readiness"])
  const next = fixture()
  next.ports.execute = async (owner, operation) => {
    expect(owner).toBe(actor)
    next.calls.push(operation.operationId)
    if (operation.operationId === next.operations[1].operationId)
      throw new Error("private database failure")
    return next.outcome(next.operations[0])
  }
  const response = await pushAuthenticatedSyncBatchV2(
    next.input,
    next.headers,
    next.ports
  )
  expect(response).toEqual({
    transportVersion: 2,
    status: "retry_later",
    results: [next.outcome(next.operations[0])],
    failedOperationId: next.operations[1].operationId,
  })
  expect(validateRemotePushResultV2(response, actor, next.input)).toEqual(
    response
  )
  expect(next.calls).toEqual([
    "session",
    "readiness",
    ...next.operations.map((operation) => operation.operationId),
  ])
  expect(JSON.stringify(response)).not.toContain("private database")
})
