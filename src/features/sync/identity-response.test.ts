import "server-only"

import { expect, test } from "bun:test"
import { syncProtocolHeader } from "@/config/sync-protocol"
import { getSyncIdentityResponse } from "@/features/sync/identity-response"
import { acceptsSyncProtocolRange } from "@/lib/sync/sync-protocol"

test("identity announces protocol without changing its authenticated body or caching", async () => {
  for (const identity of [null, { userId: "test-actor" }]) {
    const response = getSyncIdentityResponse(identity)
    expect(response.status).toBe(identity ? 200 : 401)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(
      acceptsSyncProtocolRange(response.headers.get(syncProtocolHeader))
    ).toBe(true)
    expect(await response.json()).toEqual(
      identity ?? { error: "Authentication required" }
    )
  }
  expect(() =>
    getSyncIdentityResponse({ userId: "test-actor", token: "invalid" })
  ).toThrow()
})

test("an explicit mixed identity announcement preserves the body and excludes legacy clients", async () => {
  for (const identity of [null, { userId: "test-actor" }]) {
    const response = getSyncIdentityResponse(identity, 2)
    expect(response.status).toBe(identity ? 200 : 401)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(response.headers.get("Set-Cookie")).toBeNull()
    expect(
      acceptsSyncProtocolRange(response.headers.get(syncProtocolHeader), 1)
    ).toBe(false)
    expect(
      acceptsSyncProtocolRange(response.headers.get(syncProtocolHeader), 2)
    ).toBe(true)
    expect(await response.json()).toEqual(
      identity ?? { error: "Authentication required" }
    )
  }
  const current = getSyncIdentityResponse({ userId: "test-actor" })
  expect(
    acceptsSyncProtocolRange(current.headers.get(syncProtocolHeader), 2)
  ).toBe(false)
  expect(() =>
    getSyncIdentityResponse({ userId: "test-actor", token: "invalid" }, 2)
  ).toThrow()
})

test("identity refuses invalid explicit protocol versions", () => {
  for (const version of [
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1000001,
  ])
    expect(() => getSyncIdentityResponse(null, version)).toThrow()
})
