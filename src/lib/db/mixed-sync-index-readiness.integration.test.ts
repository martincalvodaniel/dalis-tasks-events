import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { readMixedSyncIndexReadiness } from "@/lib/db/mixed-sync-index-readiness"

const config = getSyncDatabaseTestConfig()
async function ownedDatabase() {
  if (!config)
    throw new Error("Owned sync index test configuration is required")
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Index readiness database does not match its owned run")
  return database
}

describe.skipIf(!config)("owned mixed sync index readiness", () => {
  beforeAll(async () => {
    const database = await ownedDatabase()
    const selected = INDEX_SPECS.filter(
      (spec) =>
        spec.provisioning === "explicit" &&
        (spec.collection === COLLECTION_NAMES.tags ||
          spec.collection === COLLECTION_NAMES.itemViews)
    )
    expect(selected).toHaveLength(3)
    await ensureIndexes(database, selected)
  }, 30000)
  afterAll(async () => {
    await closeDatabaseConnection()
  }, 30000)
  test("recognizes centrally provisioned real index definitions without modifying them", async () => {
    await ownedDatabase()
    const collectionNames = [COLLECTION_NAMES.tags, COLLECTION_NAMES.itemViews]
    const before = await Promise.all(
      collectionNames.map(async (name) =>
        (await getCollection(name)).listIndexes().toArray()
      )
    )
    expect(await readMixedSyncIndexReadiness()).toEqual({
      ready: true,
      missing: [],
      incompatible: [],
    })
    const after = await Promise.all(
      collectionNames.map(async (name) =>
        (await getCollection(name)).listIndexes().toArray()
      )
    )
    expect(after).toEqual(before)
  }, 30000)
})
