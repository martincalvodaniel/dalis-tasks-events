import "server-only"

import { expect, test } from "bun:test"
import { pushSyncBatchV2 } from "@/features/sync/push-batch-v2"
import { OperationIdentityReuseError } from "@/lib/sync/operation-identity-reuse"
import {
  remoteOperationKind,
  validateRemotePushResultV2,
} from "@/lib/sync/remote-push-v2"
import { remoteOperationResultV2Schema } from "@/schemas/remote-operation-result-v2"
import { maximumRemotePushResultV2Bytes } from "@/schemas/remote-push-v2"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"
import type { SyncCommand, SyncOperation } from "@/types/sync"

const actor = "mixed-service-owner"
function operation(
  command: SyncCommand = { type: "item.delete", itemId: crypto.randomUUID() }
): SyncOperation {
  return {
    protocolVersion: 1,
    operationId: crypto.randomUUID(),
    baseRevision: 1,
    command,
  }
}
function request(operations: SyncOperation[]) {
  return { transportVersion: 2, expectedUserId: actor, operations }
}
function rejected(next: SyncOperation): RemoteOperationResultV2 {
  return {
    kind: remoteOperationKind(next.command),
    outcome: { operationId: next.operationId, status: "unsupported" },
  }
}
const neverExecute = async (): Promise<RemoteOperationResultV2> => {
  throw new Error("Executor must not run")
}

test("mixed batch rejects missing or switched sessions before execution", async () => {
  const input = request([operation()])
  for (const [session, status] of [
    [null, "unauthorized"],
    ["other", "account_changed"],
  ] as const)
    expect(
      await pushSyncBatchV2(input, {
        readActor: async () => session,
        execute: neverExecute,
      })
    ).toEqual({ transportVersion: 2, status })
})

test("transport and intention incompatibility pause every operation before command interpretation", async () => {
  const input = request([operation()])
  const dependencies = { readActor: async () => actor, execute: neverExecute }
  const { transportVersion: _transportVersion, ...legacy } = input
  for (const incompatible of [
    legacy,
    { ...input, transportVersion: 1 },
    { ...input, transportVersion: 3 },
    {
      ...input,
      operations: [
        operation(),
        {
          ...operation(),
          protocolVersion: 2,
          command: { type: "future.command" },
        },
      ],
    },
  ])
    expect(await pushSyncBatchV2(incompatible, dependencies)).toEqual({
      transportVersion: 2,
      status: "update_required",
    })
  for (const transportVersion of [0, -1, 1.5, 1000001, "2", null])
    expect(
      await pushSyncBatchV2({ ...input, transportVersion }, dependencies)
    ).toEqual({ transportVersion: 2, status: "invalid_batch" })
})

test("validates the complete mixed request before any prefix runs", async () => {
  const first = operation()
  for (const invalid of [
    request([]),
    request([first, first]),
    request(Array.from({ length: 51 }, () => operation())),
    { ...request([first]), actorUserId: "injected" },
    request([first, { ...operation(), baseRevision: -1 }]),
    {
      ...request([first]),
      operations: [{ ...first, actorUserId: "injected" }],
    },
    {
      ...request([first]),
      operations: [
        first,
        { ...operation(), command: { type: "future.command" } },
      ],
    },
    {
      ...request([first]),
      operations: [
        { ...first, command: { type: "future", data: "漢".repeat(200000) } },
      ],
    },
  ])
    expect(
      await pushSyncBatchV2(invalid, {
        readActor: async () => actor,
        execute: neverExecute,
      })
    ).toEqual({ transportVersion: 2, status: "invalid_batch" })
})

test("sequential mixed outcomes preserve order and identity reuse keeps its family", async () => {
  const operations = [
    operation(),
    operation({ type: "tag.delete", tagId: crypto.randomUUID() }),
    operation({
      type: "item-view.set",
      itemId: crypto.randomUUID(),
      primaryTagId: null,
    }),
  ]
  const calls: string[] = []
  let active = 0
  const input = request(operations)
  const response = await pushSyncBatchV2(input, {
    readActor: async () => actor,
    execute: async (owner, next) => {
      expect(owner).toBe(actor)
      expect(active++).toBe(0)
      calls.push(next.operationId)
      await Promise.resolve()
      active--
      if (next.operationId === operations[1].operationId)
        throw new OperationIdentityReuseError()
      return rejected(next)
    },
  })
  expect(calls).toEqual(operations.map((next) => next.operationId))
  expect(response).toEqual({
    transportVersion: 2,
    status: "complete",
    results: [
      rejected(operations[0]),
      {
        kind: "preference",
        outcome: {
          operationId: operations[1].operationId,
          status: "identity_reuse",
        },
      },
      rejected(operations[2]),
    ],
  })
  expect(validateRemotePushResultV2(response, actor, input)).toEqual(response)
})

test("transient and incoherent outcomes return only the validated prefix", async () => {
  const operations = [operation(), operation(), operation()]
  for (const failure of ["throw", "family", "identity", "owner", "target"]) {
    const calls: string[] = []
    const response = await pushSyncBatchV2(request(operations), {
      readActor: async () => actor,
      execute: async (_owner, next) => {
        calls.push(next.operationId)
        if (next.operationId !== operations[1].operationId)
          return rejected(next)
        if (failure === "throw") throw new Error("Temporary remote failure")
        if (failure === "family")
          return {
            kind: "preference",
            outcome: { operationId: next.operationId, status: "unsupported" },
          }
        if (failure === "identity") return rejected(operations[2])
        if (!("itemId" in next.command))
          throw new Error("Expected item command")
        return {
          kind: "item",
          outcome: {
            operationId: next.operationId,
            status: "applied",
            sequence: 1,
            item: {
              id:
                failure === "target"
                  ? crypto.randomUUID()
                  : next.command.itemId,
              ownerId: failure === "owner" ? "foreign" : actor,
              kind: "task",
              title: "Remote task",
              description: "",
              scheduledDate: "2026-10-08",
              status: "not_started",
              checklist: [],
              completedAt: null,
              recurrence: null,
              revision: 1,
              createdAt: "2026-10-08T00:00:00.000Z",
              updatedAt: "2026-10-08T00:00:00.000Z",
              deletedAt: null,
            },
          },
        }
      },
    })
    expect(calls).toEqual(
      operations.slice(0, 2).map((next) => next.operationId)
    )
    expect(response).toEqual({
      transportVersion: 2,
      status: "retry_later",
      results: [rejected(operations[0])],
      failedOperationId: operations[1].operationId,
    })
  }
})

test("UTF8 response overflow preserves complete outcomes and retries a possibly committed operation", async () => {
  const operations = Array.from({ length: 16 }, () => operation())
  const calls: string[] = []
  const input = request(operations)
  const checklist = Array.from({ length: 100 }, () => ({
    id: crypto.randomUUID(),
    text: "漢".repeat(500),
    completed: false,
  }))
  const response = await pushSyncBatchV2(input, {
    readActor: async () => actor,
    execute: async (_owner, next) => {
      calls.push(next.operationId)
      if (!("itemId" in next.command)) throw new Error("Expected item command")
      return remoteOperationResultV2Schema.parse({
        kind: "item",
        outcome: {
          operationId: next.operationId,
          status: "applied",
          sequence: calls.length,
          item: {
            id: next.command.itemId,
            ownerId: actor,
            kind: "task",
            title: "Large historical result",
            description: "",
            scheduledDate: "2026-10-08",
            status: "not_started",
            checklist,
            completedAt: null,
            recurrence: null,
            revision: 1,
            createdAt: "2026-10-08T00:00:00.000Z",
            updatedAt: "2026-10-08T00:00:00.000Z",
            deletedAt: null,
          },
        },
      })
    },
  })
  expect(response.status).toBe("retry_later")
  if (response.status !== "retry_later")
    throw new Error("Expected bounded retry")
  expect(response.results.length).toBeGreaterThan(0)
  expect(calls.length).toBe(response.results.length + 1)
  expect(response.failedOperationId).toBe(
    operations[response.results.length].operationId
  )
  expect(calls.at(-1)).toBe(response.failedOperationId)
  expect(
    new TextEncoder().encode(JSON.stringify(response)).byteLength
  ).toBeLessThanOrEqual(maximumRemotePushResultV2Bytes)
  for (const result of response.results) {
    if (
      result.kind !== "item" ||
      result.outcome.status !== "applied" ||
      result.outcome.item.kind !== "task"
    )
      throw new Error("Expected complete task result")
    expect(result.outcome.item.checklist).toEqual(checklist)
  }
  expect(validateRemotePushResultV2(response, actor, input)).toEqual(response)
})
