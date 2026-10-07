import { expect, test } from "bun:test"
import {
  syncBrowserCommandSchema,
  syncBrowserFixtureSchema,
} from "@/schemas/sync-browser-test"

test("browser fixtures require owned accounts and independent loopback origins", () => {
  const runId = "00000000-0000-4000-8000-000000000001"
  const input = {
    runId,
    userId: `browser-test-${runId}-sync-devices`,
    origins: ["http://127.0.0.1:4179", "http://127.0.0.1:4180"],
  }
  expect(syncBrowserFixtureSchema.safeParse(input).success).toBe(true)
  for (const invalid of [
    { ...input, userId: "real-account" },
    { ...input, origins: [input.origins[0], input.origins[0]] },
    { ...input, origins: [input.origins[0], "https://example.com"] },
    { ...input, origins: [input.origins[0], "http://localhost:4180"] },
    { ...input, origins: [input.origins[0], "http://127.0.0.1:99999"] },
  ])
    expect(syncBrowserFixtureSchema.safeParse(invalid).success).toBe(false)
  expect(syncBrowserCommandSchema.safeParse({ type: "run" }).success).toBe(true)
  expect(
    syncBrowserCommandSchema.safeParse({ type: "run", userId: "other" }).success
  ).toBe(false)
})
