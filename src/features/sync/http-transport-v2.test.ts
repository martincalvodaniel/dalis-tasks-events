import { expect, test } from "bun:test"
import { syncProtocolHeader, syncProtocolVersion } from "@/config/sync-protocol"
import { createHttpSyncTransportV2 } from "@/features/sync/http-transport-v2"
import { SyncTransportError } from "@/features/sync/transport-error"
import { encodeSyncProtocolRange } from "@/lib/sync/sync-protocol"
import type { RemoteChangesPageV2 } from "@/types/remote-changes-page-v2"
import type {
  RemotePushInputV2,
  RemotePushResultV2,
} from "@/types/remote-push-v2"

const userId = "mixed-transport-owner"
function requestInput(): RemotePushInputV2 {
  return {
    transportVersion: 2,
    expectedUserId: userId,
    operations: [
      {
        operationId: crypto.randomUUID(),
        protocolVersion: 1,
        baseRevision: 1,
        command: { type: "tag.delete", tagId: crypto.randomUUID() },
      },
    ],
  }
}
function reply(input: RemotePushInputV2): RemotePushResultV2 {
  return {
    transportVersion: 2,
    status: "complete",
    results: [
      {
        kind: "preference",
        outcome: {
          operationId: input.operations[0].operationId,
          status: "unsupported",
        },
      },
    ],
  }
}
function page(after = 0): RemoteChangesPageV2 {
  return {
    version: 2,
    changes: [],
    nextAfter: after,
    through: after,
    hasMore: false,
  }
}
function fakeFetch(
  handle: (path: string, options?: RequestInit) => Promise<Response>
): typeof fetch {
  return (async (path, options) =>
    handle(String(path), options)) as typeof fetch
}
function response(body: unknown, version = 2) {
  return Response.json(body, {
    headers: { [syncProtocolHeader]: encodeSyncProtocolRange(version) },
  })
}

test("prepared transport retains same-origin protection cookies and requires protocol two without changing the active announcement", async () => {
  expect(syncProtocolVersion).toBe(1)
  const transport = createHttpSyncTransportV2(
    userId,
    async () => null,
    fakeFetch(async (path, options) => {
      expect(path).toBe("/api/sync/identity")
      expect(options?.credentials).toBe("same-origin")
      expect(options?.cache).toBe("no-store")
      expect(options?.signal).toBeInstanceOf(AbortSignal)
      return response({ userId })
    })
  )
  expect(await transport.readIdentity()).toBe(userId)
  const anonymous = createHttpSyncTransportV2(
    userId,
    async () => null,
    fakeFetch(async () => new Response(null, { status: 401 }))
  )
  expect(await anonymous.readIdentity()).toBeNull()
})

test("pull preserves the exact query and account, including null checkpoint omission and captured caller input", async () => {
  for (const through of [null, 7]) {
    const query = { after: 7, through, limit: 3 }
    const transport = createHttpSyncTransportV2(
      userId,
      async () => null,
      fakeFetch(async (path) => {
        const params = new URL(path, "https://example.test").searchParams
        expect(Object.fromEntries(params)).toEqual({
          after: "7",
          limit: "3",
          expectedUserId: userId,
          ...(through === null ? {} : { through: "7" }),
        })
        query.after = 100
        return response(page(7))
      })
    )
    expect(await transport.pull(query)).toEqual(page(7))
  }
})

test("incompatible announcements stop before reading private payloads", async () => {
  for (const announcement of [
    null,
    "invalid",
    encodeSyncProtocolRange(1),
    encodeSyncProtocolRange(3),
  ]) {
    let reads = 0
    const transport = createHttpSyncTransportV2(
      userId,
      async () => null,
      fakeFetch(async () => {
        const value = Response.json(
          { invalid: true },
          {
            headers: announcement ? { [syncProtocolHeader]: announcement } : {},
          }
        )
        value.json = async () => {
          reads++
          throw new Error("Unexpected body read")
        }
        return value
      })
    )
    await expect(transport.readIdentity()).rejects.toMatchObject({
      reason: "update_required",
    })
    await expect(
      transport.pull({ after: 0, through: null, limit: 1 })
    ).rejects.toMatchObject({ reason: "update_required" })
    expect(reads).toBe(0)
  }
})

test("HTTP status errors distinguish identity, cursor, update and transient failures", async () => {
  for (const [status, body, reason] of [
    [401, {}, "unauthorized"],
    [
      409,
      { error: "Account changed", code: "account_changed" },
      "account_changed",
    ],
    [409, { error: "Cursor ahead", code: "cursor_ahead" }, "recovery_required"],
    [426, {}, "update_required"],
    [400, {}, "retry_later"],
    [503, {}, "retry_later"],
  ] as const) {
    const transport = createHttpSyncTransportV2(
      userId,
      async () => null,
      fakeFetch(async () => Response.json(body, { status }))
    )
    await expect(
      transport.pull({ after: 0, through: null, limit: 1 })
    ).rejects.toMatchObject({ reason })
  }
})

test("strict page reception rejects checkpoint changes, future payloads, omitted entries and foreign records", async () => {
  const item = {
    kind: "task",
    id: crypto.randomUUID(),
    ownerId: userId,
    title: "Task",
    description: "",
    scheduledDate: "2026-10-09",
    status: "not_started",
    checklist: [],
    recurrence: null,
    completedAt: null,
    revision: 1,
    createdAt: "2026-10-09T00:00:00.000Z",
    updatedAt: "2026-10-09T00:00:00.000Z",
    deletedAt: null,
  }
  const change = {
    version: 2,
    kind: "item",
    recipientUserId: userId,
    operationId: crypto.randomUUID(),
    sequence: 1,
    item,
  }
  const valid = {
    version: 2,
    changes: [change],
    nextAfter: 1,
    through: 1,
    hasMore: false,
  }
  for (const invalid of [
    { ...page(), version: 3 },
    { ...page(), nextAfter: 1, through: 1 },
    { ...valid, through: 2, hasMore: true },
    {
      ...valid,
      changes: [
        {
          ...change,
          recipientUserId: "foreign",
          item: { ...item, ownerId: "foreign" },
        },
      ],
    },
    { ...valid, changes: [{ ...change, item: { ...item, revision: 0 } }] },
    { ...page(), extra: true },
  ]) {
    const transport = createHttpSyncTransportV2(
      userId,
      async () => null,
      fakeFetch(async () => response(invalid))
    )
    await expect(
      transport.pull({ after: 0, through: 1, limit: 1 })
    ).rejects.toThrow()
  }
})

test("mixed push validates exact correspondence, including a valid empty retry prefix and rejects callback mutation", async () => {
  const input = requestInput()
  const before = structuredClone(input)
  const received: unknown[] = []
  const transport = createHttpSyncTransportV2(userId, async (value) => {
    received.push(value)
    return reply(input)
  })
  expect(await transport.push(input)).toEqual(reply(input))
  expect(received).toEqual([input])
  await expect(
    transport.push({ ...input, expectedUserId: "other" })
  ).rejects.toMatchObject({ reason: "account_changed" })
  await expect(
    transport.push({
      ...input,
      transportVersion: 1,
    } as unknown as RemotePushInputV2)
  ).rejects.toThrow()
  expect(received).toHaveLength(1)
  for (const invalid of [
    { ...reply(input), transportVersion: 1 },
    {
      ...reply(input),
      results: [
        {
          kind: "item",
          outcome: {
            operationId: input.operations[0].operationId,
            status: "unsupported",
          },
        },
      ],
    },
    {
      ...reply(input),
      results: [
        {
          kind: "preference",
          outcome: { operationId: crypto.randomUUID(), status: "unsupported" },
        },
      ],
    },
    {
      transportVersion: 2,
      status: "retry_later",
      results: [],
      failedOperationId: crypto.randomUUID(),
    },
    { ...reply(input), results: [] },
  ]) {
    const malformed = createHttpSyncTransportV2(userId, async () => invalid)
    await expect(malformed.push(input)).rejects.toThrow()
  }
  const retry: RemotePushResultV2 = {
    transportVersion: 2,
    status: "retry_later",
    results: [],
    failedOperationId: input.operations[0].operationId,
  }
  expect(
    await createHttpSyncTransportV2(userId, async () => retry).push(input)
  ).toEqual(retry)
  const mutated = createHttpSyncTransportV2(userId, async (value) => {
    const supplied = value as RemotePushInputV2
    supplied.operations[0].operationId = crypto.randomUUID()
    return reply(supplied)
  })
  await expect(mutated.push(input)).rejects.toThrow()
  expect(input).toEqual(before)
})

test("deadlines abort fetch and preserve an action intention after a late remote response", async () => {
  let signal: AbortSignal | null = null
  const aborted = createHttpSyncTransportV2(
    userId,
    async () => null,
    fakeFetch(
      async (_path, options) =>
        new Promise((_resolve, reject) => {
          signal = options?.signal ?? null
          signal?.addEventListener(
            "abort",
            () => reject(new SyncTransportError("retry_later")),
            { once: true }
          )
        })
    ),
    5
  )
  await expect(aborted.readIdentity()).rejects.toMatchObject({
    reason: "retry_later",
  })
  expect((signal as AbortSignal | null)?.aborted).toBe(true)
  const input = requestInput(),
    before = structuredClone(input)
  let resolve: (value: unknown) => void = () => undefined
  const late = createHttpSyncTransportV2(
    userId,
    async () =>
      new Promise((done) => {
        resolve = done
      }),
    fetch,
    5
  )
  await expect(late.push(input)).rejects.toMatchObject({
    reason: "retry_later",
  })
  resolve(reply(input))
  expect(input).toEqual(before)
  for (const timeout of [0, NaN, 60001, 0.5])
    expect(() =>
      createHttpSyncTransportV2(userId, async () => null, fetch, timeout)
    ).toThrow()
})
