import "server-only"

import { expect, test } from "bun:test"
import { syncProtocolHeader } from "@/config/sync-protocol"
import {
  type AuthenticatedPullPortsV2,
  getAuthenticatedSyncChangesResponseV2,
} from "@/features/sync/authenticated-pull-v2"
import { acceptsSyncProtocolRange } from "@/lib/sync/sync-protocol"
import type { RemoteChangesPageV2 } from "@/types/remote-changes-page-v2"

const actor = "authenticated-pull-owner"
function fixture() {
  const calls: string[] = []
  const request = new Request(
    `https://example.test/sync?expectedUserId=${actor}&after=3&through=3&limit=2`,
    {
      headers: { cookie: "opaque-test-session", "x-request-marker": "first" },
    }
  )
  const page: RemoteChangesPageV2 = {
    version: 2,
    changes: [],
    nextAfter: 3,
    through: 3,
    hasMore: false,
  }
  const ports: AuthenticatedPullPortsV2 = {
    readSession: async (headers) => {
      calls.push("session")
      expect(headers).toBe(request.headers)
      expect(headers.get("cookie")).toBe("opaque-test-session")
      return { user: { id: actor } }
    },
    readReadiness: async () => {
      calls.push("readiness")
      return { ready: true, missing: [], incompatible: [] }
    },
    readChanges: async (userId, query) => {
      calls.push("journal")
      expect(userId).toBe(actor)
      expect(query).toEqual({ after: 3, through: 3, limit: 2 })
      return page
    },
  }
  return { calls, request, ports, page }
}

test("authenticated pull passes exact request headers and receives a private validated v2 page", async () => {
  const f = fixture()
  const response = await getAuthenticatedSyncChangesResponseV2(
    f.request,
    f.ports
  )
  expect(response.status).toBe(200)
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  expect(
    acceptsSyncProtocolRange(response.headers.get(syncProtocolHeader), 1)
  ).toBe(false)
  expect(
    acceptsSyncProtocolRange(response.headers.get(syncProtocolHeader), 2)
  ).toBe(true)
  expect(await response.json()).toEqual(f.page)
  expect(f.calls).toEqual(["session", "readiness", "journal"])
  const other = new Request(f.request.url, {
    headers: { cookie: "second-session" },
  })
  f.ports.readSession = async (headers) => {
    expect(headers).toBe(other.headers)
    expect(headers.get("cookie")).toBe("second-session")
    return null
  }
  expect(
    (await getAuthenticatedSyncChangesResponseV2(other, f.ports)).status
  ).toBe(401)
  expect(f.calls).toEqual(["session", "readiness", "journal"])
})

test("rejected or failed sessions never reach readiness or the journal", async () => {
  for (const mode of ["null", "error"]) {
    const f = fixture()
    f.ports.readSession = async (headers) => {
      expect(headers).toBe(f.request.headers)
      f.calls.push("session")
      if (mode === "error") throw new Error("private user@example.test session")
      return null
    }
    const response = await getAuthenticatedSyncChangesResponseV2(
      f.request,
      f.ports
    )
    expect(response.status).toBe(mode === "null" ? 401 : 503)
    expect(await response.text()).not.toContain("user@example.test")
    expect(f.calls).toEqual(["session"])
  }
})

test("query accounts cannot inject an actor and invalid queries never inspect indexes", async () => {
  for (const [query, status] of [
    ["expectedUserId=other", 409],
    ["", 400],
    [`expectedUserId=${actor}&actor=injected`, 400],
    [`expectedUserId=${actor}&limit=101`, 400],
    [`expectedUserId=${actor}&after=4&through=3`, 400],
  ] as const) {
    const f = fixture()
    const request = new Request(`https://example.test/sync?${query}`)
    f.ports.readSession = async (headers) => {
      expect(headers).toBe(request.headers)
      f.calls.push("session")
      return { user: { id: actor } }
    }
    const response = await getAuthenticatedSyncChangesResponseV2(
      request,
      f.ports
    )
    expect(response.status).toBe(status)
    expect(f.calls).toEqual(["session"])
  }
})

test("readiness precedes journal access and malformed complete pages are rejected", async () => {
  const f = fixture()
  f.ports.readReadiness = async () => {
    f.calls.push("readiness")
    return { ready: true, missing: ["private-index"], incompatible: [] }
  }
  const unavailable = await getAuthenticatedSyncChangesResponseV2(
    f.request,
    f.ports
  )
  expect(unavailable.status).toBe(503)
  expect(await unavailable.text()).not.toContain("private-index")
  expect(f.calls).toEqual(["session", "readiness"])
  for (const page of [
    { ...f.page, version: 3 },
    { ...f.page, through: 4, hasMore: true },
    { ...f.page, extra: true },
  ]) {
    const next = fixture()
    next.ports.readChanges = async () => {
      next.calls.push("journal")
      return page as RemoteChangesPageV2
    }
    const response = await getAuthenticatedSyncChangesResponseV2(
      next.request,
      next.ports
    )
    expect(response.status).toBe(503)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(next.calls).toEqual(["session", "readiness", "journal"])
  }
})
