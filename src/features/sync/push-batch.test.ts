import "server-only"

import { describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { pushSyncBatch } from "@/features/sync/push-batch"
import { authorizePersistedSession } from "@/lib/auth/authorized-session"
import { OperationIdentityReuseError } from "@/lib/db/remote-item-commands"
import type { SyncOperation } from "@/types/sync"

function operation(): SyncOperation {
  return {
    operationId: randomUUID(),
    protocolVersion: 1,
    baseRevision: 1,
    command: { type: "item.delete", itemId: randomUUID() },
  }
}

describe("authenticated sync batch", () => {
  test("a session switch cannot upload account A data under account B", async () => {
    const result = await pushSyncBatch(
      { expectedUserId: "account-a", operations: [operation()] },
      {
        readActor: async () => "account-b",
        execute: async () => {
          throw new Error("Executor must not run after a session switch")
        },
      }
    )
    expect(result).toEqual({ status: "account_changed" })
    expect(
      await pushSyncBatch(
        { operations: [operation()] },
        {
          readActor: async () => "account-a",
          execute: async () => {
            throw new Error("Executor must not run without an expected account")
          },
        }
      )
    ).toEqual({ status: "invalid_batch" })
  })
  test("a missing, expired or disallowed session never reaches the executor", async () => {
    const now = new Date("2026-10-08T00:00:00Z")
    const session = {
      user: {
        id: "test-actor",
        email: "test@example.test",
        emailVerified: true,
      },
      session: {
        userId: "test-actor",
        expiresAt: new Date("2026-10-09T00:00:00Z"),
      },
    }
    for (const candidate of [
      null,
      { ...session, session: { ...session.session, expiresAt: now } },
      { ...session, user: { ...session.user, email: "other@example.test" } },
    ]) {
      const result = await pushSyncBatch(
        { expectedUserId: "test-actor", operations: [operation()] },
        {
          readActor: async () =>
            authorizePersistedSession(
              candidate,
              new Set(["test@example.test"]),
              now
            )?.user.id ?? null,
          execute: async () => {
            throw new Error("Executor must not run")
          },
        }
      )
      expect(result).toEqual({ status: "unauthorized" })
    }
  })

  test("validates the entire batch before writing and rejects actor injection", async () => {
    const first = operation()
    for (const input of [
      { expectedUserId: "test-actor", operations: [] },
      {
        expectedUserId: "test-actor",
        operations: [first, { ...operation(), baseRevision: -1 }],
      },
      { expectedUserId: "test-actor", operations: [first, first] },
      {
        expectedUserId: "test-actor",
        operations: Array.from({ length: 51 }, operation),
      },
      {
        expectedUserId: "test-actor",
        operations: [first],
        actorUserId: "other",
      },
      {
        expectedUserId: "test-actor",
        operations: [{ ...first, actorUserId: "other" }],
      },
    ]) {
      expect(
        await pushSyncBatch(input, {
          readActor: async () => "test-actor",
          execute: async () => {
            throw new Error("Executor must not run")
          },
        })
      ).toEqual({ status: "invalid_batch" })
    }
  })

  test("uses the session actor and executes sequentially, preserving unsupported results", async () => {
    const operations = Array.from({ length: 3 }, operation)
    const calls: string[] = []
    let active = 0
    const result = await pushSyncBatch(
      { expectedUserId: "test-actor", operations },
      {
        readActor: async () => "test-actor",
        execute: async (actor, item) => {
          expect(actor).toBe("test-actor")
          expect(active++).toBe(0)
          calls.push(item.operationId)
          await Promise.resolve()
          active--
          return { status: "unsupported", operationId: item.operationId }
        },
      }
    )
    expect(calls).toEqual(operations.map((item) => item.operationId))
    expect(result).toEqual({
      status: "complete",
      results: operations.map((item) => ({
        status: "unsupported",
        operationId: item.operationId,
      })),
    })
  })

  test("returns the completed prefix on transient failure and does not run later operations", async () => {
    const operations = Array.from({ length: 3 }, operation)
    const calls: string[] = []
    const result = await pushSyncBatch(
      { expectedUserId: "test-actor", operations },
      {
        readActor: async () => "test-actor",
        execute: async (_actor, item) => {
          calls.push(item.operationId)
          if (
            item === operations[1] ||
            item.operationId === operations[1].operationId
          )
            throw new Error("Temporary database failure")
          return { status: "unavailable", operationId: item.operationId }
        },
      }
    )
    expect(calls).toEqual(
      operations.slice(0, 2).map((item) => item.operationId)
    )
    expect(result).toEqual({
      status: "retry_later",
      failedOperationId: operations[1].operationId,
      results: [
        { status: "unavailable", operationId: operations[0].operationId },
      ],
    })
  })

  test("identity reuse is rejected explicitly while independent operations continue", async () => {
    const operations = Array.from({ length: 2 }, operation)
    const result = await pushSyncBatch(
      { expectedUserId: "test-actor", operations },
      {
        readActor: async () => "test-actor",
        execute: async (_actor, item) => {
          if (item.operationId === operations[0].operationId)
            throw new OperationIdentityReuseError()
          return { status: "unsupported", operationId: item.operationId }
        },
      }
    )
    expect(result).toEqual({
      status: "complete",
      results: [
        { status: "identity_reuse", operationId: operations[0].operationId },
        { status: "unsupported", operationId: operations[1].operationId },
      ],
    })
  })
})
