import { expect, test } from "bun:test"
import { offlineCacheKey } from "@/lib/pwa/cache-policy"

const origin = "https://dalis.example.test"
const assets = new Set(["/workspace", "/_next/static/app.js", "/icon-192.png"])

test("offline cache allows only neutral navigation and listed static resources", () => {
  const request = {
    method: "GET",
    mode: "navigate",
    url: `${origin}/workspace?day=2026-10-06`,
  }
  expect(offlineCacheKey(request, origin, assets)).toBe("/workspace")
  expect(
    offlineCacheKey(
      { ...request, mode: "cors", url: `${origin}/_next/static/app.js` },
      origin,
      assets
    )
  ).toBe("/_next/static/app.js")
  for (const url of [
    "/",
    "/auth/signin",
    "/api/sync/identity",
    "/workspace?_rsc=test",
    "/unknown.js",
    "/_next/static/app.js?private=test",
  ]) {
    expect(
      offlineCacheKey(
        { ...request, mode: "cors", url: `${origin}${url}` },
        origin,
        assets
      )
    ).toBeNull()
  }
  expect(
    offlineCacheKey({ ...request, method: "POST" }, origin, assets)
  ).toBeNull()
  expect(
    offlineCacheKey(
      { ...request, url: "https://other.example.test/workspace" },
      origin,
      assets
    )
  ).toBeNull()
})
