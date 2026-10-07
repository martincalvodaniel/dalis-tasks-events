import "server-only"

import { describe, expect, test } from "bun:test"
import { getSyncChangesResponse } from "@/features/sync/pull-response"
import { RemoteCursorAheadError } from "@/lib/db/remote-changes"

const empty = { changes: [], nextAfter: 0, through: 0, hasMore: false }

describe("private sync download", () => {
  test("requires an actor and always disables caching", async () => {
    const response = await getSyncChangesResponse(
      new Request("https://example.test/api/sync/changes"),
      {
        readActor: async () => null,
        readChanges: async () => {
          throw new Error("Reader must not run")
        },
      }
    )
    expect(response.status).toBe(401)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  })
  test("rejects duplicate, unknown, fractional and excessive query inputs before reading", async () => {
    for (const query of [
      "after=0&after=1",
      "actor=other",
      "after=-1",
      "after=1.2",
      "limit=101",
      "after=3&through=2",
      "after=1e2",
      "after=",
      "through=null",
    ]) {
      const response = await getSyncChangesResponse(
        new Request(`https://example.test/api/sync/changes?${query}`),
        {
          readActor: async () => "test-actor",
          readChanges: async () => {
            throw new Error("Reader must not run")
          },
        }
      )
      expect(response.status).toBe(400)
    }
  })
  test("passes only the session actor and validated checkpoint to the reader", async () => {
    const response = await getSyncChangesResponse(
      new Request(
        "https://example.test/api/sync/changes?after=0&through=0&limit=1"
      ),
      {
        readActor: async () => "test-actor",
        readChanges: async (actor, query) => {
          expect(actor).toBe("test-actor")
          expect(query).toEqual({ after: 0, through: 0, limit: 1 })
          return empty
        },
      }
    )
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(await response.json()).toEqual(empty)
  })
  test("reports future cursors and hides internal failures without advancing a page", async () => {
    for (const [error, status] of [
      [new RemoteCursorAheadError(), 409],
      [new Error("Private database details"), 503],
    ] as const) {
      const response = await getSyncChangesResponse(
        new Request("https://example.test/api/sync/changes"),
        {
          readActor: async () => "test-actor",
          readChanges: async () => {
            throw error
          },
        }
      )
      expect(response.status).toBe(status)
      expect(await response.text()).not.toContain("Private database details")
      expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    }
  })
})
