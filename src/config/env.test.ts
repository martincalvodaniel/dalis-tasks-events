import "server-only"

import { afterEach, expect, test } from "bun:test"
import { getDatabaseEnv } from "@/config/env"

const names = ["MONGODB_URI", "VERCEL_ENV", "VERCEL_GIT_COMMIT_REF"] as const
const previous = Object.fromEntries(
  names.map((name) => [name, process.env[name]])
)
afterEach(() => {
  for (const name of names) {
    const value = previous[name]
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

test("appearance bootstrap requires both trusted Preview and integration branch metadata", () => {
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017"
  for (const [environment, branch, allowed] of [
    ["preview", "int", true],
    ["production", "int", false],
    ["development", "int", false],
    ["preview", "main", false],
    ["preview", "", false],
    ["", "int", false],
  ] as const) {
    process.env.VERCEL_ENV = environment
    process.env.VERCEL_GIT_COMMIT_REF = branch
    expect(getDatabaseEnv().isIntegrationPreview).toBe(allowed)
  }
})
