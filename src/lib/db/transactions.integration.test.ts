import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"

const config = getSyncDatabaseTestConfig()

describe.skipIf(!config)("isolated MongoDB transactions", () => {
  beforeAll(async () => {
    if (!config) throw new Error("Sync database test configuration is required")
    const database = await getDatabase()
    expect(database.databaseName).toBe(config.mongodbDatabase)
    const hello = await database.admin().command({ hello: 1 })
    expect(hello.setName).toBe("dalis-sync-test")
    expect(hello.isWritablePrimary).toBe(true)
  }, 30000)

  afterAll(async () => {
    try {
      const database = await getDatabase()
      if (database.databaseName !== config?.mongodbDatabase)
        throw new Error("Cleanup database does not match the test run")
      await database.dropDatabase()
    } finally {
      await closeDatabaseConnection()
    }
  }, 30000)

  test("commits both writes and makes them visible outside the transaction", async () => {
    const database = await getDatabase()
    const collection = await getCollection<{ _id: string; value: number }>(
      COLLECTION_NAMES.authVerification
    )
    await database.client.withSession(async (session) =>
      session.withTransaction(async () => {
        await collection.insertOne(
          { _id: "committed-first", value: 1 },
          { session }
        )
        await collection.insertOne(
          { _id: "committed-second", value: 2 },
          { session }
        )
        expect(await collection.countDocuments({ _id: /^committed-/ })).toBe(0)
      })
    )
    const result = await collection
      .find({ _id: /^committed-/ })
      .sort({ _id: 1 })
      .toArray()
    expect(result.map(({ value }) => value)).toEqual([1, 2])
  }, 30000)

  test("rolls back the first write after a later failure, then recovers", async () => {
    const database = await getDatabase()
    const collection = await getCollection<{ _id: string; value: number }>(
      COLLECTION_NAMES.authVerification
    )
    await expect(
      database.client.withSession(async (session) =>
        session.withTransaction(async () => {
          await collection.insertOne(
            { _id: "aborted-first", value: 3 },
            { session }
          )
          await collection.insertOne(
            { _id: "committed-first", value: 4 },
            { session }
          )
        })
      )
    ).rejects.toThrow()
    expect(await collection.findOne({ _id: "aborted-first" })).toBeNull()
    expect((await collection.findOne({ _id: "committed-first" }))?.value).toBe(
      1
    )
    await database.client.withSession(async (session) =>
      session.withTransaction(async () => {
        await collection.insertOne({ _id: "recovered", value: 5 }, { session })
      })
    )
    expect((await collection.findOne({ _id: "recovered" }))?.value).toBe(5)
  }, 30000)
})
