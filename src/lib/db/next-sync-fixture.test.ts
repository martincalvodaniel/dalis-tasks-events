import { describe, expect, test } from "bun:test"
import {
  nextSyncProcessEnvironment,
  parseNextSyncTestEnvironment,
} from "@/config/next-sync-test"
import {
  assertNextSyncOwnedCookies,
  validateNextSyncFixtureHeaders,
  validateNextSyncFixtureRequest,
} from "@/lib/db/next-sync-fixture"

const runId = "11111111-1111-4111-8111-111111111111"
const config = {
  runId,
  port: 27019,
  mongodbUri:
    "mongodb://127.0.0.1:27019/?replicaSet=dalis-sync-test&directConnection=true",
  mongodbDatabase: `dalis-sync-test-${runId}`,
  origins: ["http://127.0.0.1:31001", "http://localhost:31002"] as [
    string,
    string,
  ],
  controlOrigin: "http://127.0.0.1:31003",
  authOrigin: "http://127.0.0.1:31001",
  secret: `dalis-next-test-${runId}${runId}`,
}
describe("isolated Next fixture guards", () => {
  test("accepts Next-normalized loopback URLs only with the exact original Host and Origin", () => {
    const normalized = "http://localhost:31001/fixture/guard"
    const headers = {
      host: "127.0.0.1:31001",
      origin: config.authOrigin,
    }
    expect(
      validateNextSyncFixtureRequest(
        new Request(normalized, { headers }),
        { runId },
        config
      ).selected
    ).toEqual([])
    for (const request of [
      new Request(normalized, {
        headers: { ...headers, host: "localhost:31001" },
      }),
      new Request(normalized, {
        headers: { ...headers, origin: config.origins[1] },
      }),
      new Request("https://localhost:31001/fixture/guard", { headers }),
      new Request(normalized, {
        headers: {
          origin: config.authOrigin,
          "x-forwarded-host": headers.host,
        },
      }),
    ])
      expect(() =>
        validateNextSyncFixtureRequest(request, { runId }, config)
      ).toThrow()
  })
  test("validates only exact synthetic environment without importing auth", () => {
    const environment = nextSyncProcessEnvironment(config, "")
    expect(parseNextSyncTestEnvironment(environment)).toEqual(config)
    for (const override of [
      { MONGODB_DB: "dalis-tasks-events" },
      { MONGODB_URI: "mongodb://localhost:27019" },
      { RUN_NEXT_SYNC_TESTS: "0" },
      { BETTER_AUTH_URL: "https://example.com" },
      { GOOGLE_CLIENT_SECRET: "real-secret" },
      { ALLOWED_EMAILS: "real@example.com" },
    ])
      expect(() =>
        parseNextSyncTestEnvironment({ ...environment, ...override })
      ).toThrow()
  })
  test("capability and origin checks precede all auth initialization", () => {
    expect(
      validateNextSyncFixtureHeaders(new Headers(), { runId }, config).selected
    ).toEqual([])
    expect(() =>
      validateNextSyncFixtureHeaders(
        new Headers(),
        { runId: crypto.randomUUID() },
        config
      )
    ).toThrow()
    expect(() =>
      validateNextSyncFixtureHeaders(
        new Headers({ origin: config.origins[1] }),
        { runId },
        config
      )
    ).toThrow()
  })
  test("preserves foreign auth cookies and only recognizes exact owned signed values", () => {
    const registered = new Map([
      ["own+signed", { name: "better-auth.session_token" }],
    ])
    expect(
      assertNextSyncOwnedCookies(
        new Headers({
          cookie: "other=value; better-auth.session_token=own%2Bsigned",
        }),
        registered
      )
    ).toEqual(["own+signed"])
    for (const cookie of [
      "better-auth.session_token=foreign",
      "__Secure-better-auth.session_token=own%2Bsigned",
      "better-auth.session_data=foreign",
      "better-auth.session_token=%ZZ",
    ])
      expect(() =>
        assertNextSyncOwnedCookies(new Headers({ cookie }), registered)
      ).toThrow("Foreign auth cookies block the fixture")
    expect(
      assertNextSyncOwnedCookies(
        new Headers({ cookie: "unrelated=value" }),
        registered
      )
    ).toEqual([])
  })
})
