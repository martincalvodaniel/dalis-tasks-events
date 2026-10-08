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
