import { expect, test } from "bun:test"
import {
  planSyncProtocolVersion,
  recurringSyncProtocolVersion,
  syncProtocolHeader,
} from "@/config/sync-protocol"
import { createHttpRecurringSyncTransport } from "@/features/sync/http-recurring-transport"
import { createHttpSyncTransportForProtocol } from "@/features/sync/http-transport-v2"
import { SyncTransportError } from "@/features/sync/transport-error"
import { planRemotePlanOccurrenceOperation } from "@/lib/calendar/remote-plan-occurrence-plan"
import { encodeSyncProtocolRange } from "@/lib/sync/sync-protocol"
import { planSchema } from "@/schemas/plan-item"
import type { RemotePushInputV2 } from "@/types/remote-push-v2"
import type { RemoteRecurringPushResult } from "@/types/remote-recurring-push"
import type { RemoteRecurringChangesPage } from "@/types/remote-recurring-sync"

const actor = "future-http-fixture",
  timestamp = "2026-10-11T09:00:00.000Z"
function fixture() {
  const parent = planSchema.parse({
    kind: "plan",
    variant: "note",
    id: crypto.randomUUID(),
    ownerId: actor,
    title: "Own",
    description: "",
    status: "not_started",
    checklist: [],
    completedAt: null,
    schedule: {
      mode: "all_day",
      startDate: "2026-10-11",
      endDateExclusive: "2026-10-12",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-11",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  })
  const request: RemotePushInputV2 = {
    transportVersion: 2,
    expectedUserId: actor,
    operations: [
      {
        operationId: crypto.randomUUID(),
        protocolVersion: 1,
        baseRevision: 1,
        command: {
          type: "plan.set-occurrence-status",
          itemId: parent.id,
          occurrenceId: `${parent.id}:2026-10-11`,
          expectedOccurrenceRevision: 0,
          status: "completed",
        },
      },
    ],
  }
  const planned = planRemotePlanOccurrenceOperation({
    userId: actor,
    timestamp,
    series: parent,
    current: null,
    operation: request.operations[0],
  })
  if (planned.status !== "changes")
    throw new Error("Expected fixture appearance")
  const outcome = {
    operationId: request.operations[0].operationId,
    status: "applied" as const,
    occurrence: planned.record,
    seriesRevision: 1,
    sequence: 2,
  }
  const response: RemoteRecurringPushResult = {
    transportVersion: 2,
    status: "complete",
    results: [{ kind: "plan-occurrence", userId: actor, outcome }],
  }
  const page: RemoteRecurringChangesPage = {
    version: 2,
    changes: [
      {
        version: 2,
        kind: "item",
        recipientUserId: actor,
        operationId: crypto.randomUUID(),
        sequence: 1,
        item: parent,
      },
      {
        version: 2,
        kind: "plan-occurrence",
        recipientUserId: actor,
        operationId: request.operations[0].operationId,
        sequence: 2,
        seriesRevision: 1,
        occurrence: planned.record,
      },
    ],
    nextAfter: 2,
    through: 2,
    hasMore: false,
  }
  return { request, response, page }
}
function fetchPort(
  handle: (path: string, options?: RequestInit) => Promise<Response>
): typeof fetch {
  return (async (path, options) =>
    handle(String(path), options)) as typeof fetch
}
function response(body: unknown, header = encodeSyncProtocolRange(5)) {
  return Response.json(body, { headers: { [syncProtocolHeader]: header } })
}

test("future transport retains protection cookies, exact query and envelopes while decoding recurrent pages and results", async () => {
  const value = fixture(),
    before = structuredClone(value)
  expect(recurringSyncProtocolVersion).toBe(5)
  expect(planSyncProtocolVersion).toBe(4)
  const transport = createHttpRecurringSyncTransport(
    actor,
    async (input) => {
      expect(input).toEqual(value.request)
      return value.response
    },
    fetchPort(async (path, options) => {
      expect(options).toMatchObject({
        credentials: "same-origin",
        cache: "no-store",
      })
      expect(options?.signal).toBeInstanceOf(AbortSignal)
      if (path === "/api/sync/identity") return response({ userId: actor })
      expect(
        Object.fromEntries(new URL(path, "https://example.test").searchParams)
      ).toEqual({
        after: "0",
        through: "2",
        limit: "50",
        expectedUserId: actor,
      })
      return response(value.page)
    })
  )
  expect(await transport.readIdentity()).toBe(actor)
  expect(await transport.pull({ after: 0, through: 2, limit: 50 })).toEqual(
    value.page
  )
  expect(await transport.push(value.request)).toEqual(value.response)
  expect(value).toEqual(before)
})

test("generation five rejects missing, old, future and mixed headers before reading any body", async () => {
  const value = fixture()
  for (const header of [
    null,
    encodeSyncProtocolRange(4),
    encodeSyncProtocolRange(6),
    JSON.stringify({ minimum: 4, maximum: 5 }),
    "invalid",
    "x".repeat(129),
  ]) {
    let reads = 0
    const transport = createHttpRecurringSyncTransport(
      actor,
      async () => null,
      fetchPort(async () => {
        const res = response(value.page)
        if (header === null) res.headers.delete(syncProtocolHeader)
        else res.headers.set(syncProtocolHeader, header)
        res.json = async () => {
          reads++
          return value.page
        }
        return res
      })
    )
    await expect(
      transport.pull({ after: 0, through: null, limit: 50 })
    ).rejects.toMatchObject({ reason: "update_required" })
    await expect(transport.readIdentity()).rejects.toMatchObject({
      reason: "update_required",
    })
    expect(reads).toBe(0)
  }
  let oldReads = 0
  const old = createHttpSyncTransportForProtocol(
    4,
    actor,
    async () => null,
    fetchPort(async () => {
      const res = response(value.page)
      res.json = async () => {
        oldReads++
        return value.page
      }
      return res
    })
  )
  await expect(
    old.pull({ after: 0, through: null, limit: 50 })
  ).rejects.toMatchObject({ reason: "update_required" })
  expect(oldReads).toBe(0)
})

test("foreign account and malformed push intentions fail before submission; mismatched outcomes do not validate", async () => {
  const value = fixture()
  let sends = 0
  const transport = createHttpRecurringSyncTransport(actor, async () => {
    sends++
    return value.response
  })
  await expect(
    transport.push({ ...value.request, expectedUserId: "foreign" })
  ).rejects.toMatchObject({ reason: "account_changed" })
  await expect(
    transport.push({
      ...value.request,
      operations: [value.request.operations[0], value.request.operations[0]],
    })
  ).rejects.toThrow()
  expect(sends).toBe(0)
  const incompatible = createHttpRecurringSyncTransport(actor, async () => ({
    transportVersion: 2,
    status: "complete",
    results: [
      {
        kind: "item",
        outcome: {
          operationId: value.request.operations[0].operationId,
          status: "unsupported",
        },
      },
    ],
  }))
  await expect(incompatible.push(value.request)).rejects.toThrow()
})

test("HTTP auth and recovery statuses remain distinct and push deadlines preserve the intention", async () => {
  for (const [status, code, reason] of [
    [401, undefined, "unauthorized"],
    [426, undefined, "update_required"],
    [503, undefined, "retry_later"],
    [409, "account_changed", "account_changed"],
    [409, "cursor_ahead", "recovery_required"],
  ] as const) {
    const transport = createHttpRecurringSyncTransport(
      actor,
      async () => null,
      fetchPort(async () =>
        Response.json(
          { error: "Own test failure", ...(code ? { code } : {}) },
          { status }
        )
      )
    )
    await expect(
      transport.pull({ after: 0, through: null, limit: 50 })
    ).rejects.toMatchObject({ reason })
    if (status === 401) expect(await transport.readIdentity()).toBeNull()
  }
  const value = fixture(),
    before = structuredClone(value.request)
  const transport = createHttpRecurringSyncTransport(
    actor,
    async () => new Promise(() => {}),
    fetch,
    2
  )
  await expect(transport.push(value.request)).rejects.toBeInstanceOf(
    SyncTransportError
  )
  expect(value.request).toEqual(before)
  for (const timeout of [0, 60001, NaN])
    expect(() =>
      createHttpRecurringSyncTransport(actor, async () => null, fetch, timeout)
    ).toThrow()
})
