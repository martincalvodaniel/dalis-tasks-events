import "server-only"

import type { z } from "zod"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { nextSyncPrivateConfigSchema } from "@/schemas/next-sync-test"
import { syncDatabaseTestConfigSchema } from "@/schemas/sync-database-test"

export type NextSyncPrivateConfig = z.infer<typeof nextSyncPrivateConfigSchema>
export function fixtureEmail(
  runId: string,
  identity: "owner" | "other" | "unverified"
) {
  return `${identity}-${runId}@next-sync.invalid`
}

// This parser is pure so normal tests never initialize or poison the auth singleton.
export function parseNextSyncTestEnvironment(
  environment: Record<string, string | undefined>
): NextSyncPrivateConfig {
  if (
    environment.RUN_NEXT_SYNC_TESTS !== "1" ||
    environment.RUN_SYNC_DB_TESTS !== "1" ||
    environment.RUN_AUTH_DB_TESTS !== "0"
  )
    throw new Error("Next sync fixture flags are required")
  const config = nextSyncPrivateConfigSchema.parse({
    runId: environment.SYNC_TEST_RUN_ID,
    port: Number(environment.SYNC_TEST_PORT),
    mongodbUri: environment.MONGODB_URI,
    mongodbDatabase: environment.MONGODB_DB,
    origins: [
      environment.NEXT_SYNC_TEST_PRIMARY_ORIGIN,
      environment.NEXT_SYNC_TEST_SECONDARY_ORIGIN,
    ],
    authOrigin: environment.BETTER_AUTH_URL,
    controlOrigin: environment.NEXT_SYNC_TEST_CONTROL_ORIGIN,
    secret: environment.BETTER_AUTH_SECRET,
  })
  if (
    environment.GOOGLE_CLIENT_ID !== "dalis-next-test-client" ||
    environment.GOOGLE_CLIENT_SECRET !== "dalis-next-test-google-secret" ||
    environment.ALLOWED_EMAILS !==
      ["owner", "other", "unverified"]
        .map((identity) =>
          fixtureEmail(
            config.runId,
            identity as "owner" | "other" | "unverified"
          )
        )
        .join(",")
  )
    throw new Error(
      "Next sync fixture requires only its synthetic auth configuration"
    )
  return config
}
export function getNextSyncTestConfig() {
  return parseNextSyncTestEnvironment(process.env)
}
export function getNextSyncRunnerConfig() {
  const descriptor = getSyncDatabaseTestConfig()
  if (!descriptor)
    throw new Error("Next sync runner requires an isolated descriptor")
  return {
    descriptor: syncDatabaseTestConfigSchema.parse(descriptor),
    path: process.env.PATH ?? "",
  }
}
export function nextSyncProcessEnvironment(
  config: NextSyncPrivateConfig,
  path: string
) {
  const parsed = nextSyncPrivateConfigSchema.parse(config)
  return {
    PATH: path,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    RUN_NEXT_SYNC_TESTS: "1",
    RUN_SYNC_DB_TESTS: "1",
    RUN_AUTH_DB_TESTS: "0",
    SYNC_TEST_RUN_ID: parsed.runId,
    SYNC_TEST_PORT: String(parsed.port),
    MONGODB_URI: parsed.mongodbUri,
    MONGODB_DB: parsed.mongodbDatabase,
    NEXT_SYNC_TEST_PRIMARY_ORIGIN: parsed.origins[0],
    NEXT_SYNC_TEST_SECONDARY_ORIGIN: parsed.origins[1],
    NEXT_SYNC_TEST_CONTROL_ORIGIN: parsed.controlOrigin,
    BETTER_AUTH_URL: parsed.authOrigin,
    BETTER_AUTH_SECRET: parsed.secret,
    GOOGLE_CLIENT_ID: "dalis-next-test-client",
    GOOGLE_CLIENT_SECRET: "dalis-next-test-google-secret",
    ALLOWED_EMAILS: (["owner", "other", "unverified"] as const)
      .map((identity) => fixtureEmail(parsed.runId, identity))
      .join(","),
  }
}
