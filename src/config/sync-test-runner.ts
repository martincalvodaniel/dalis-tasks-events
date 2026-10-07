import type { z } from "zod"
import { syncDatabaseTestConfigSchema } from "@/schemas/sync-database-test"

export const syncTestImage =
  "mongo@sha256:b8806ee8207318a30316eca72257da4c146025a80fdcdb4c597e596af9233ee3"
export type SyncDatabaseTestConfig = z.infer<
  typeof syncDatabaseTestConfigSchema
>

export function syncTestProcessEnvironment(config: SyncDatabaseTestConfig) {
  const parsed = syncDatabaseTestConfigSchema.parse(config)
  return {
    PATH: process.env.PATH ?? "",
    NODE_ENV: "test",
    RUN_AUTH_DB_TESTS: "0",
    RUN_SYNC_DB_TESTS: "1",
    SYNC_TEST_RUN_ID: parsed.runId,
    SYNC_TEST_PORT: String(parsed.port),
    MONGODB_URI: parsed.mongodbUri,
    MONGODB_DB: parsed.mongodbDatabase,
  }
}
