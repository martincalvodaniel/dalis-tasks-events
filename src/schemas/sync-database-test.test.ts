import { describe, expect, test } from "bun:test"
import { syncDatabaseTestConfigSchema } from "@/schemas/sync-database-test"

const runId = "00000000-0000-4000-8000-000000000001"
const valid = {
  runId,
  port: 27179,
  mongodbUri:
    "mongodb://127.0.0.1:27179/?replicaSet=dalis-sync-test&directConnection=true",
  mongodbDatabase: `dalis-sync-test-${runId}`,
}

describe("isolated sync database test configuration", () => {
  test("accepts only the matching run descriptor and returns a copy", () => {
    expect(syncDatabaseTestConfigSchema.parse(valid)).toEqual(valid)
    expect(syncDatabaseTestConfigSchema.parse(valid)).not.toBe(valid)
    for (const port of [1024, 65535])
      expect(
        syncDatabaseTestConfigSchema.safeParse({
          ...valid,
          port,
          mongodbUri: `mongodb://127.0.0.1:${port}/?replicaSet=dalis-sync-test&directConnection=true`,
        }).success
      ).toBe(true)
  })
  test("rejects remote, ambiguous or modified connections", () => {
    for (const mongodbUri of [
      "mongodb://example.test:27179/",
      "mongodb+srv://example.test/",
      valid.mongodbUri.replace("127.0.0.1", "localhost"),
      valid.mongodbUri.replace("127.0.0.1", "127.0.0.1,example.test"),
      valid.mongodbUri.replace("127.0.0.1", "user:pass@127.0.0.1"),
      valid.mongodbUri.replace("27179", "27180"),
      valid.mongodbUri.replace("dalis-sync-test", "other-set"),
      valid.mongodbUri.replace("true", "false"),
      `${valid.mongodbUri}&tls=false`,
    ])
      expect(
        syncDatabaseTestConfigSchema.safeParse({ ...valid, mongodbUri }).success
      ).toBe(false)
  })
  test("rejects normal, auth and mismatched run databases or invalid fields", () => {
    for (const patch of [
      { mongodbDatabase: "dalis-tasks-events" },
      { mongodbDatabase: `dalis-auth-test-${runId}` },
      { mongodbDatabase: "dalis-sync-test-other" },
      { runId: "00000000-0000-4000-8000-000000000002" },
      { runId: "invalid" },
      { port: 1023 },
      { port: 65536 },
      { port: 27179.5 },
      { port: NaN },
      { port: "27179" },
      { cleanupAllowed: true },
    ])
      expect(
        syncDatabaseTestConfigSchema.safeParse({ ...valid, ...patch }).success
      ).toBe(false)
  })
})
