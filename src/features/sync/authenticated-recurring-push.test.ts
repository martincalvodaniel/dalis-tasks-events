import "server-only"

import { expect, test } from "bun:test"
import {
  type AuthenticatedRecurringPushPorts,
  pushAuthenticatedRecurringSyncBatch,
} from "@/features/sync/authenticated-recurring-push"
import { OperationIdentityReuseError } from "@/lib/sync/operation-identity-reuse"
import {
  remoteRecurringOperationKind,
  validateRemoteRecurringPushResult,
} from "@/lib/sync/remote-recurring-push"
import type { RemoteRecurringOperationResult } from "@/types/remote-recurring-sync"
import type { SyncOperation } from "@/types/sync"

const actor = "prepared-recurring-auth"
function fixture() {
  const itemId = crypto.randomUUID(),
    headers = new Headers({ cookie: "opaque-test-session" })
  const operations: SyncOperation[] = [
    {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 1,
      command: { type: "item.delete", itemId },
    },
    {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 1,
      command: {
        type: "plan.cancel-occurrence",
        itemId,
        occurrenceId: `${itemId}:2026-10-11`,
        expectedOccurrenceRevision: 0,
      },
    },
    {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 1,
      command: { type: "tag.delete", tagId: crypto.randomUUID() },
    },
  ]
  const input = {
    transportVersion: 2 as const,
    expectedUserId: actor,
    operations,
  }
  const calls: string[] = []
  const ports: AuthenticatedRecurringPushPorts = {
    readSession: async (received) => {
      expect(received).toBe(headers)
      calls.push("session")
      return { user: { id: actor } }
    },
    readReadiness: async () => {
      calls.push("readiness-five")
      return { ready: true, missing: [], incompatible: [] }
    },
    execute: async (user, operation) => {
      expect(user).toBe(actor)
      expect(operations).toContainEqual(operation)
      calls.push(operation.operationId)
      const kind = remoteRecurringOperationKind(operation.command)
      const outcome = {
        operationId: operation.operationId,
        status: "unsupported" as const,
      }
      return kind === "plan-occurrence"
        ? { kind, userId: user, outcome }
        : { kind, outcome }
    },
  }
  return { operations, input, headers, calls, ports }
}

test("future authenticated service validates the session and readiness once before all three executor families", async () => {
  const value = fixture(),
    before = structuredClone(value.input)
  const result = await pushAuthenticatedRecurringSyncBatch(
    value.input,
    value.headers,
    value.ports
  )
  expect(validateRemoteRecurringPushResult(result, actor, value.input)).toEqual(
    result
  )
  expect(result.status).toBe("complete")
  expect(value.calls).toEqual([
    "session",
    "readiness-five",
    ...value.operations.map((op) => op.operationId),
  ])
  expect(value.input).toEqual(before)
})

test("missing, changed and unavailable authentication never inspects storage or executes", async () => {
  for (const session of [null, { user: { id: "foreign" } }]) {
    const value = fixture()
    value.ports.readSession = async () => session
    expect(
      await pushAuthenticatedRecurringSyncBatch(
        value.input,
        value.headers,
        value.ports
      )
    ).toEqual({
      transportVersion: 2,
      status: session ? "account_changed" : "unauthorized",
    })
    expect(value.calls).toEqual([])
  }
  const value = fixture()
  value.ports.readSession = async () => {
    throw new Error("Sensitive test detail")
  }
  await expect(
    pushAuthenticatedRecurringSyncBatch(value.input, value.headers, value.ports)
  ).rejects.toThrow("Sync authentication is temporarily unavailable")
  expect(value.calls).toEqual([])
})

test("incompatible envelopes and invalid batches reject before readiness or command interpretation", async () => {
  for (const [change, status] of [
    [{ transportVersion: 1 }, "update_required"],
    [{ transportVersion: 5 }, "update_required"],
    [
      {
        operations: [
          {
            ...fixture().operations[0],
            protocolVersion: 2,
            command: { type: "future.command" },
          },
        ],
      },
      "update_required",
    ],
    [
      {
        operations: [
          { ...fixture().operations[0], command: { type: "future.command" } },
        ],
      },
      "invalid_batch",
    ],
    [{ extra: true }, "invalid_batch"],
    [{ operations: [] }, "invalid_batch"],
  ] as const) {
    const value = fixture()
    expect(
      await pushAuthenticatedRecurringSyncBatch(
        { ...value.input, ...change },
        value.headers,
        value.ports
      )
    ).toEqual({ transportVersion: 2, status })
    expect(value.calls).toEqual(["session"])
  }
})

test("missing, incompatible or unavailable index definitions pause before any executor", async () => {
  for (const readiness of [
    {
      ready: false,
      missing: ["plan_occurrences_user_series_slot_uidx"],
      incompatible: [],
    },
    {
      ready: true,
      missing: [],
      incompatible: ["plan_occurrences_user_series_slot_uidx"],
    },
    null,
  ]) {
    const value = fixture()
    value.ports.readReadiness = async () => {
      value.calls.push("readiness")
      if (!readiness) throw new Error("Sensitive storage detail")
      return readiness
    }
    expect(
      await pushAuthenticatedRecurringSyncBatch(
        value.input,
        value.headers,
        value.ports
      )
    ).toEqual({
      transportVersion: 2,
      status: "retry_later",
      results: [],
      failedOperationId: value.operations[0].operationId,
    })
    expect(value.calls).toEqual(["session", "readiness"])
  }
})

test("partial failures preserve the exact prefix; identity reuse uses its actual family and actor", async () => {
  for (const index of [0, 1, 2]) {
    const value = fixture(),
      original = value.ports.execute
    value.ports.execute = async (user, operation) => {
      if (operation.operationId === value.operations[index].operationId)
        throw new Error("A response may be lost after commit")
      return original(user, operation)
    }
    const result = await pushAuthenticatedRecurringSyncBatch(
      value.input,
      value.headers,
      value.ports
    )
    expect(
      validateRemoteRecurringPushResult(result, actor, value.input)
    ).toEqual(result)
    expect(result).toMatchObject({
      status: "retry_later",
      failedOperationId: value.operations[index].operationId,
    })
    if (result.status !== "retry_later") throw new Error("Expected retry")
    expect(result.results).toHaveLength(index)
  }
  const value = fixture()
  value.ports.execute = async () => {
    throw new OperationIdentityReuseError()
  }
  const result = await pushAuthenticatedRecurringSyncBatch(
    value.input,
    value.headers,
    value.ports
  )
  expect(result.status).toBe("complete")
  if (result.status !== "complete")
    throw new Error("Expected complete identity results")
  expect(result.results.map((entry) => entry.kind)).toEqual([
    "item",
    "plan-occurrence",
    "preference",
  ])
  expect(result.results[1]).toMatchObject({
    userId: actor,
    outcome: { status: "identity_reuse" },
  })
})

test("mismatched executor results cannot enter an acknowledged prefix", async () => {
  const value = fixture(),
    original = value.ports.execute
  value.ports.execute = async (
    user,
    operation
  ): Promise<RemoteRecurringOperationResult> =>
    operation.operationId === value.operations[1].operationId
      ? {
          kind: "plan-occurrence",
          userId: "foreign",
          outcome: {
            operationId: operation.operationId,
            status: "unsupported",
          },
        }
      : original(user, operation)
  const result = await pushAuthenticatedRecurringSyncBatch(
    value.input,
    value.headers,
    value.ports
  )
  expect(result).toMatchObject({
    status: "retry_later",
    failedOperationId: value.operations[1].operationId,
  })
  if (result.status !== "retry_later") throw new Error("Expected retry")
  expect(result.results).toHaveLength(1)
})
