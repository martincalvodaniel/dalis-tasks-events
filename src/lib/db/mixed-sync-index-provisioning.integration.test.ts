import "server-only"

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import {
  COLLECTION_NAMES,
  type CollectionName,
  getCollection,
} from "@/lib/db/collections"
import { ensureIndexes, type IndexSpec } from "@/lib/db/ensure-indexes"
import {
  type MixedSyncIndexProvisioningPorts,
  provisionMixedSyncIndexes,
} from "@/lib/db/mixed-sync-index-provisioning"
import { readMixedSyncIndexReadiness } from "@/lib/db/mixed-sync-index-readiness"
import { selectMixedSyncIndexSpecs } from "@/lib/db/mixed-sync-index-specs"
import { mixedSyncIndexNames } from "@/schemas/mixed-sync-index-provisioning"
import type { Tag } from "@/types/preferences"

const config = getSyncDatabaseTestConfig()
const actor = `index-provisioning-${config?.runId}`
const [viewName, identityName, activeName] = mixedSyncIndexNames
const ownedIndexes = new Map<string, IndexSpec>()
const ownedRecordIds = new Set<string>()
let freshDatabaseVerified = false
type TagDocument = Tag & { _id: string }

async function ownedDatabase() {
  if (!config) throw new Error("Owned index test configuration is required")
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Index provisioning database does not match its owned run")
  return database
}

async function assertMissingIndexes() {
  expect(await readMixedSyncIndexReadiness()).toEqual({
    ready: false,
    missing: [...mixedSyncIndexNames],
    incompatible: [],
  })
}

async function cleanOwnedResources() {
  if (!freshDatabaseVerified) return
  await ownedDatabase()
  if (ownedRecordIds.size) {
    await (await getCollection<TagDocument>(COLLECTION_NAMES.tags)).deleteMany({
      _id: { $in: [...ownedRecordIds] },
      userId: actor,
    })
    ownedRecordIds.clear()
  }
  for (const [name, spec] of ownedIndexes) {
    await (await getCollection(spec.collection as CollectionName)).dropIndex(
      name
    )
    ownedIndexes.delete(name)
  }
}

function ports(calls: string[]): MixedSyncIndexProvisioningPorts {
  return {
    readReadiness: readMixedSyncIndexReadiness,
    createIndex: async (spec) => {
      const database = await ownedDatabase()
      calls.push(spec.options.name)
      await ensureIndexes(database, [spec])
      // Record only successful creations in this fresh owned database, including a subsequently lost reply.
      ownedIndexes.set(spec.options.name, structuredClone(spec))
    },
  }
}

function duplicateCategory(id: string): TagDocument {
  return {
    _id: JSON.stringify([actor, id]),
    id,
    userId: actor,
    name: "Owned duplicate category",
    normalizedName: "owned duplicate category",
    color: "#123456",
    position: 1024,
    revision: 1,
    createdAt: "2026-10-09T00:00:00.000Z",
    updatedAt: "2026-10-09T00:00:00.000Z",
    deletedAt: null,
  }
}

describe.skipIf(!config)("owned mixed sync index provisioning", () => {
  beforeAll(async () => {
    await ownedDatabase()
    await assertMissingIndexes()
    for (const collection of [
      COLLECTION_NAMES.tags,
      COLLECTION_NAMES.itemViews,
    ])
      expect(await (await getCollection(collection)).countDocuments({})).toBe(0)
    freshDatabaseVerified = true
  }, 30000)

  beforeEach(async () => {
    if (!freshDatabaseVerified)
      throw new Error("Index provisioning requires a verified fresh database")
    await cleanOwnedResources()
    await assertMissingIndexes()
  }, 30000)

  afterAll(async () => {
    try {
      await cleanOwnedResources()
    } finally {
      await closeDatabaseConnection()
    }
  }, 30000)

  test("preserves the real successful prefix and duplicate records, then retries only the missing index", async () => {
    const collection = await getCollection<TagDocument>(COLLECTION_NAMES.tags)
    const records = [
      duplicateCategory(crypto.randomUUID()),
      duplicateCategory(crypto.randomUUID()),
    ]
    for (const record of records) ownedRecordIds.add(record._id)
    await collection.insertMany(records)
    const before = await collection
      .find({ userId: actor })
      .sort({ _id: 1 })
      .toArray()
    const calls: string[] = []
    const failed = await provisionMixedSyncIndexes(ports(calls))
    expect(failed).toEqual({
      status: "creation_failed",
      created: [viewName, identityName],
      readiness: { ready: false, missing: [activeName], incompatible: [] },
      error: "duplicate_data",
    })
    expect(calls).toEqual([...mixedSyncIndexNames])
    expect(
      await collection.find({ userId: actor }).sort({ _id: 1 }).toArray()
    ).toEqual(before)
    expect(JSON.stringify(failed)).not.toContain(actor)
    expect(JSON.stringify(failed)).not.toContain(records[0].normalizedName)

    // Remove one exact test fixture explicitly; provisioning itself performs no data repair.
    expect(
      (await collection.deleteOne({ _id: records[1]._id, userId: actor }))
        .deletedCount
    ).toBe(1)
    const retryCalls: string[] = []
    expect(await provisionMixedSyncIndexes(ports(retryCalls))).toEqual({
      status: "ready",
      created: [activeName],
      readiness: { ready: true, missing: [], incompatible: [] },
      error: null,
    })
    expect(retryCalls).toEqual([activeName])
    expect(await collection.find({ userId: actor }).toArray()).toEqual([
      records[0],
    ])
    const noopCalls: string[] = []
    expect(await provisionMixedSyncIndexes(ports(noopCalls))).toEqual({
      status: "ready",
      created: [],
      readiness: { ready: true, missing: [], incompatible: [] },
      error: null,
    })
    expect(noopCalls).toEqual([])
    expect([...ownedIndexes.values()]).toEqual(selectMixedSyncIndexSpecs())
  }, 30000)

  test("observes a committed first index after a lost reply and retries only the remaining definitions", async () => {
    const calls: string[] = []
    const operationPorts = ports(calls)
    const create = operationPorts.createIndex
    operationPorts.createIndex = async (spec) => {
      await create(spec)
      throw new Error("Intentional lost owned index creation reply")
    }
    expect(await provisionMixedSyncIndexes(operationPorts)).toEqual({
      status: "creation_failed",
      created: [],
      readiness: {
        ready: false,
        missing: [identityName, activeName],
        incompatible: [],
      },
      error: "creation_failed",
    })
    expect(calls).toEqual([viewName])
    expect([...ownedIndexes.keys()]).toEqual([viewName])
    const retryCalls: string[] = []
    expect(await provisionMixedSyncIndexes(ports(retryCalls))).toEqual({
      status: "ready",
      created: [identityName, activeName],
      readiness: { ready: true, missing: [], incompatible: [] },
      error: null,
    })
    expect(retryCalls).toEqual([identityName, activeName])
    expect([...ownedIndexes.values()]).toEqual(selectMixedSyncIndexSpecs())
  }, 30000)
})
