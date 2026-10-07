import { describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { createHttpSyncTransport } from "@/features/sync/http-transport"
import { SyncTransportError } from "@/features/sync/transport-error"

const cursor = { key: "pull-cursor" as const, after: 2, through: 5 }
function input() {
  return {
    expectedUserId: "test-actor",
    operations: [
      {
        operationId: randomUUID(),
        protocolVersion: 1 as const,
        baseRevision: 1,
        command: { type: "item.delete" as const, itemId: randomUUID() },
      },
    ],
  }
}
function fakeFetch(
  handle: (input: string, options?: RequestInit) => Promise<Response>
): typeof fetch {
  return handle as unknown as typeof fetch
}

describe("private HTTP sync transport", () => {
  test("identity requests carry cookies, avoid cache and validate stable identity", async () => {
    const transport = createHttpSyncTransport(
      "test-actor",
      async () => null,
      fakeFetch(async (url, options) => {
        expect(url).toBe("/api/sync/identity")
        expect(options?.credentials).toBe("same-origin")
        expect(options?.cache).toBe("no-store")
        expect(options?.signal).toBeInstanceOf(AbortSignal)
        return Response.json({ userId: "test-actor" })
      })
    )
    expect(await transport.readIdentity()).toBe("test-actor")
    const unauthorized = createHttpSyncTransport(
      "test-actor",
      async () => null,
      fakeFetch(async () => new Response(null, { status: 401 }))
    )
    expect(await unauthorized.readIdentity()).toBeNull()
  })
  test("pull preserves checkpoint and expected account in the bounded query", async () => {
    const transport = createHttpSyncTransport(
      "test-actor",
      async () => null,
      fakeFetch(async (url, options) => {
        const query = new URL(url, "https://example.test").searchParams
        expect(Object.fromEntries(query)).toEqual({
          after: "2",
          through: "5",
          limit: "50",
          expectedUserId: "test-actor",
        })
        expect(options?.cache).toBe("no-store")
        return Response.json({
          changes: [3, 4, 5].map((sequence) => ({
            recipientUserId: "test-actor",
            operationId: randomUUID(),
            sequence,
            item: {
              kind: "task",
              id: randomUUID(),
              ownerId: "test-actor",
              title: "Test task",
              description: "",
              scheduledDate: "2026-10-08",
              status: "not_started",
              checklist: [],
              recurrence: null,
              completedAt: null,
              revision: 1,
              createdAt: "2026-10-08T00:00:00.000Z",
              updatedAt: "2026-10-08T00:00:00.000Z",
              deletedAt: null,
            },
          })),
          nextAfter: 5,
          through: 5,
          hasMore: false,
        })
      })
    )
    expect(await transport.pull(cursor)).toMatchObject({ nextAfter: 5 })
  })
  test("unauthorized, account switch and cursor restoration require distinct actions", async () => {
    for (const [status, body, reason] of [
      [401, {}, "unauthorized"],
      [
        409,
        { error: "Authenticated account changed", code: "account_changed" },
        "account_changed",
      ],
      [
        409,
        { error: "Cursor ahead", code: "cursor_ahead" },
        "recovery_required",
      ],
      [503, {}, "retry_later"],
    ] as const) {
      const transport = createHttpSyncTransport(
        "test-actor",
        async () => null,
        fakeFetch(async () => Response.json(body, { status }))
      )
      try {
        await transport.pull(cursor)
        throw new Error("Expected transport failure")
      } catch (error) {
        expect(error).toBeInstanceOf(SyncTransportError)
        expect((error as SyncTransportError).reason).toBe(reason)
      }
    }
  })
  test("push validates both sides and never invokes a callback for another expected account", async () => {
    const value = input()
    const calls: unknown[] = []
    const transport = createHttpSyncTransport(
      "test-actor",
      async (submitted) => {
        calls.push(submitted)
        return {
          status: "complete",
          results: [
            {
              status: "unsupported",
              operationId: value.operations[0].operationId,
            },
          ],
        }
      }
    )
    expect(await transport.push(value)).toMatchObject({ status: "complete" })
    expect(calls).toEqual([value])
    await expect(
      transport.push({ ...value, expectedUserId: "other" })
    ).rejects.toBeInstanceOf(SyncTransportError)
    expect(calls).toHaveLength(1)
    await expect(transport.push({ ...value, operations: [] })).rejects.toThrow()
    const malformed = createHttpSyncTransport("test-actor", async () => ({
      status: "complete",
      results: [],
    }))
    await expect(malformed.push(value)).rejects.toThrow()
  })
  test("a lost action response is bounded without accepting or rewriting its operation", async () => {
    const value = input()
    const original = JSON.stringify(value)
    const transport = createHttpSyncTransport(
      "test-actor",
      async () => new Promise(() => undefined),
      fetch,
      5
    )
    await expect(transport.push(value)).rejects.toBeInstanceOf(
      SyncTransportError
    )
    expect(JSON.stringify(value)).toBe(original)
  })
  test("fetch deadlines abort requests and malformed identity or page data is rejected", async () => {
    const aborted = createHttpSyncTransport(
      "test-actor",
      async () => null,
      fakeFetch(
        async (_url, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener(
              "abort",
              () => reject(new Error("Request aborted")),
              { once: true }
            )
          })
      ),
      5
    )
    await expect(aborted.readIdentity()).rejects.toThrow("aborted")
    const invalid = createHttpSyncTransport(
      "test-actor",
      async () => null,
      fakeFetch(async () => Response.json({ userId: 123 }))
    )
    await expect(invalid.readIdentity()).rejects.toThrow()
    await expect(invalid.pull(cursor)).rejects.toThrow()
    const skipped = createHttpSyncTransport(
      "test-actor",
      async () => null,
      fakeFetch(async () =>
        Response.json({ changes: [], nextAfter: 5, through: 5, hasMore: false })
      )
    )
    await expect(skipped.pull(cursor)).rejects.toThrow()
  })
})
