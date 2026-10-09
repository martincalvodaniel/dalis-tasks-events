import "server-only"

import { expect, test } from "bun:test"
import {
  type AuthenticatedPushPortsV3,
  pushAuthenticatedSyncBatchV3,
} from "@/features/sync/authenticated-push-v3"
import { validateRemotePushResultV2 } from "@/lib/sync/remote-push-v2"
import type { SyncOperation } from "@/types/sync"

const actor = "placement-authenticated-owner"
const timestamp = "2026-10-09T00:00:00.000Z"
function fixture() {
  const itemId = crypto.randomUUID()
  const headers = new Headers({ cookie: "opaque-own-test-session" })
  const operations: SyncOperation[] = [0, 1].map((baseRevision) => ({
    protocolVersion: 1,
    operationId: crypto.randomUUID(),
    baseRevision,
    command: {
      type: "task.move",
      itemId,
      occurrenceId: null,
      scope: "day",
      date: "2026-10-09",
      tagId: null,
      beforeId: null,
      afterId: null,
    },
  }))
  const input = {
    transportVersion: 2 as const,
    expectedUserId: actor,
    operations,
  }
  const calls: string[] = []
  const ports: AuthenticatedPushPortsV3 = {
    readSession: async (received) => {
      expect(received).toBe(headers)
      calls.push("session")
      return { user: { id: actor } }
    },
    readReadiness: async () => {
      calls.push("readiness-four")
      return { ready: true, missing: [], incompatible: [] }
    },
    execute: async (userId, operation) => {
      expect(userId).toBe(actor)
      const index = operations.findIndex(
        (value) => value.operationId === operation.operationId
      )
      expect(index).toBeGreaterThanOrEqual(0)
      expect(operation).toEqual(operations[index])
      calls.push(operation.operationId)
      return {
        kind: "preference",
        outcome: {
          status: "applied",
          operationId: operation.operationId,
          effects: {
            version: 1,
            userId: actor,
            operationId: operation.operationId,
            sequence: index + 1,
            effects: [
              {
                store: "taskPlacements",
                record: {
                  userId: actor,
                  occurrenceId: itemId,
                  scope: "day",
                  date: "2026-10-09",
                  tagId: null,
                  position: index * 1024,
                  revision: index + 1,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                  deletedAt: null,
                },
              },
            ],
          },
        },
      }
    },
  }
  return { input, headers, ports, calls }
}

test("generation-three authentication reuses envelope two and checks readiness once before placement execution", async () => {
  const value = fixture()
  const original = structuredClone(value.input)
  const result = await pushAuthenticatedSyncBatchV3(
    value.input,
    value.headers,
    value.ports
  )
  expect(result.transportVersion).toBe(2)
  expect(result.status).toBe("complete")
  expect(validateRemotePushResultV2(result, actor, value.input)).toEqual(result)
  expect(value.calls).toEqual([
    "session",
    "readiness-four",
    ...value.input.operations.map((operation) => operation.operationId),
  ])
  expect(value.input).toEqual(original)
  if (!("results" in result))
    throw new Error("Expected complete placement results")
  expect(result.results.map((entry) => entry.outcome.status)).toEqual([
    "applied",
    "applied",
  ])
})

test("session, account and malformed or wrong-generation input reject before index inspection", async () => {
  for (const [transform, status] of [
    [
      (input: ReturnType<typeof fixture>["input"]) => ({
        ...input,
        expectedUserId: "foreign",
      }),
      "account_changed",
    ],
    [
      (input: ReturnType<typeof fixture>["input"]) => ({
        ...input,
        transportVersion: 3,
      }),
      "update_required",
    ],
    [
      (input: ReturnType<typeof fixture>["input"]) => ({
        ...input,
        injected: "actor",
      }),
      "invalid_batch",
    ],
    [
      (input: ReturnType<typeof fixture>["input"]) => ({
        ...input,
        operations: [],
      }),
      "invalid_batch",
    ],
  ] as const) {
    const value = fixture()
    expect(
      await pushAuthenticatedSyncBatchV3(
        transform(value.input),
        value.headers,
        value.ports
      )
    ).toEqual({ transportVersion: 2, status })
    expect(value.calls).toEqual(["session"])
  }
  const value = fixture()
  value.ports.readSession = async () => null
  expect(
    await pushAuthenticatedSyncBatchV3(value.input, value.headers, value.ports)
  ).toEqual({ transportVersion: 2, status: "unauthorized" })
  expect(value.calls).toEqual([])
  value.ports.readSession = async () => {
    throw new Error("private-token@example.test")
  }
  await expect(
    pushAuthenticatedSyncBatchV3(value.input, value.headers, value.ports)
  ).rejects.toThrow("Sync authentication is temporarily unavailable")
  expect(value.calls).toEqual([])
})

test("missing placement indexes, incompatible definitions and inspection failures never execute or ACK", async () => {
  for (const readiness of [
    {
      ready: false,
      missing: ["task_placements_user_scope_date_occurrence_uidx"],
      incompatible: [],
    },
    {
      ready: false,
      missing: [],
      incompatible: ["task_placements_user_scope_date_occurrence_uidx"],
    },
    {
      ready: true,
      missing: ["task_placements_user_scope_date_occurrence_uidx"],
      incompatible: [],
    },
    null,
  ]) {
    const value = fixture()
    value.ports.readReadiness = async () => {
      value.calls.push("readiness-four")
      if (!readiness) throw new Error("private-index-error")
      return readiness
    }
    expect(
      await pushAuthenticatedSyncBatchV3(
        value.input,
        value.headers,
        value.ports
      )
    ).toEqual({
      transportVersion: 2,
      status: "retry_later",
      results: [],
      failedOperationId: value.input.operations[0].operationId,
    })
    expect(value.calls).toEqual(["session", "readiness-four"])
  }
})
