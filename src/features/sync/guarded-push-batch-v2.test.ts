import "server-only"

import { expect, test } from "bun:test"
import {
  type GuardedPushDependenciesV2,
  pushGuardedSyncBatchV2,
} from "@/features/sync/guarded-push-batch-v2"
import { validateRemotePushResultV2 } from "@/lib/sync/remote-push-v2"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"
import type { SyncOperation } from "@/types/sync"

const actor = "guarded-batch-owner"
const timestamp = "2026-10-09T10:00:00.000Z"
const metadata = {
  revision: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp,
}
function fixture() {
  const operations: SyncOperation[] = [
    {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 0,
      command: { type: "item.delete", itemId: crypto.randomUUID() },
    },
    {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 0,
      command: { type: "tag.delete", tagId: crypto.randomUUID() },
    },
  ]
  const input = {
    transportVersion: 2 as const,
    expectedUserId: actor,
    operations,
  }
  const calls: string[] = []
  const outcome = (operation: SyncOperation): RemoteOperationResultV2 => {
    if (operation.command.type === "item.delete")
      return {
        kind: "item",
        outcome: {
          operationId: operation.operationId,
          status: "applied",
          sequence: 1,
          item: {
            ...metadata,
            id: operation.command.itemId,
            ownerId: actor,
            kind: "task",
            title: "Deleted task",
            description: "",
            scheduledDate: "2026-10-09",
            status: "not_started",
            checklist: [],
            completedAt: null,
            recurrence: null,
          },
        },
      }
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
          sequence: 2,
          effects: [
            {
              store: "tags",
              record: {
                ...metadata,
                id: operation.command.tagId,
                userId: actor,
                name: "Work",
                normalizedName: "work",
                color: "#123456",
                position: 0,
              },
            },
          ],
        },
      },
    }
  }
  const dependencies: GuardedPushDependenciesV2 = {
    readActor: async () => {
      calls.push("actor")
      return actor
    },
    readReadiness: async () => {
      calls.push("readiness")
      return { ready: true, missing: [], incompatible: [] }
    },
    execute: async (owner, operation) => {
      expect(owner).toBe(actor)
      calls.push(operation.operationId)
      return outcome(operation)
    },
  }
  return { input, operations, calls, dependencies, outcome }
}

test("invalid accounts, batches and incompatible protocols never read readiness", async () => {
  const f = fixture()
  const { transportVersion: _version, ...legacy } = f.input
  for (const [input, status] of [
    [legacy, "update_required"],
    [{ ...f.input, transportVersion: 3 }, "update_required"],
    [{ ...f.input, expectedUserId: "other" }, "account_changed"],
    [{ ...f.input, extra: true }, "invalid_batch"],
    [{ ...f.input, operations: [] }, "invalid_batch"],
    [
      { ...f.input, operations: [{ ...f.operations[0], protocolVersion: 2 }] },
      "update_required",
    ],
  ] as const) {
    f.calls.length = 0
    expect(await pushGuardedSyncBatchV2(input, f.dependencies)).toEqual({
      transportVersion: 2,
      status,
    })
    expect(f.calls).toEqual(["actor"])
  }
  f.calls.length = 0
  f.dependencies.readActor = async () => null
  expect(await pushGuardedSyncBatchV2(f.input, f.dependencies)).toEqual({
    transportVersion: 2,
    status: "unauthorized",
  })
  expect(f.calls).toEqual([])
})

test("failed, incomplete or inconsistent readiness retries the first UUID without executing", async () => {
  for (const readiness of [
    null,
    {},
    { ready: false, missing: [], incompatible: [] },
    { ready: true, missing: ["private-index"], incompatible: [] },
    { ready: true, missing: [], incompatible: ["private-definition"] },
    { ready: true, missing: [], incompatible: null },
    "throw",
  ]) {
    const f = fixture()
    f.dependencies.readReadiness = async () => {
      f.calls.push("readiness")
      if (readiness === "throw")
        throw new Error("private database user@example.test")
      return readiness as Awaited<
        ReturnType<GuardedPushDependenciesV2["readReadiness"]>
      >
    }
    const response = await pushGuardedSyncBatchV2(f.input, f.dependencies)
    expect(response).toEqual({
      transportVersion: 2,
      status: "retry_later",
      results: [],
      failedOperationId: f.operations[0].operationId,
    })
    expect(f.calls).toEqual(["actor", "readiness"])
    expect(JSON.stringify(response)).not.toContain("private")
  }
})

test("validates actual mixed outcomes while observing readiness exactly once before execution", async () => {
  const f = fixture()
  const original = structuredClone(f.input)
  const response = await pushGuardedSyncBatchV2(f.input, f.dependencies)
  expect(response).toEqual({
    transportVersion: 2,
    status: "complete",
    results: f.operations.map(f.outcome),
  })
  expect(f.calls).toEqual([
    "actor",
    "readiness",
    ...f.operations.map((operation) => operation.operationId),
  ])
  expect(validateRemotePushResultV2(response, actor, f.input)).toEqual(response)
  expect(f.input).toEqual(original)
})

test("authentication exceptions propagate a generic error without cause or private details", async () => {
  const f = fixture()
  f.dependencies.readActor = async () => {
    throw new Error("private user@example.test token")
  }
  let caught: unknown
  try {
    await pushGuardedSyncBatchV2(f.input, f.dependencies)
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(Error)
  const error = caught as Error
  expect(error.message).toBe("Sync authentication is temporarily unavailable")
  expect(error.cause).toBeUndefined()
  expect(error.stack).not.toContain("user@example.test")
  expect(f.calls).toEqual([])
})

test("executor failure or corrupt second result preserves the committed validated prefix", async () => {
  for (const mode of ["throw", "corrupt"]) {
    const f = fixture()
    f.dependencies.execute = async (_, operation) => {
      f.calls.push(operation.operationId)
      if (operation.operationId === f.operations[1].operationId) {
        if (mode === "throw") throw new Error("private database failure")
        return f.outcome(f.operations[0])
      }
      return f.outcome(operation)
    }
    const response = await pushGuardedSyncBatchV2(f.input, f.dependencies)
    expect(response).toEqual({
      transportVersion: 2,
      status: "retry_later",
      results: [f.outcome(f.operations[0])],
      failedOperationId: f.operations[1].operationId,
    })
    expect(validateRemotePushResultV2(response, actor, f.input)).toEqual(
      response
    )
    expect(f.calls).toEqual([
      "actor",
      "readiness",
      ...f.operations.map((operation) => operation.operationId),
    ])
  }
})

test("each invocation rereads readiness rather than caching a previous successful guard", async () => {
  const f = fixture()
  expect((await pushGuardedSyncBatchV2(f.input, f.dependencies)).status).toBe(
    "complete"
  )
  f.calls.length = 0
  f.dependencies.readReadiness = async () => {
    f.calls.push("readiness")
    return { ready: false, missing: [], incompatible: [] }
  }
  expect(await pushGuardedSyncBatchV2(f.input, f.dependencies)).toEqual({
    transportVersion: 2,
    status: "retry_later",
    results: [],
    failedOperationId: f.operations[0].operationId,
  })
  expect(f.calls).toEqual(["actor", "readiness"])
})
