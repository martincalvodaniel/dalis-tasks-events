import "server-only"

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test"
import { resolve } from "node:path"
import { MongoServerError } from "mongodb"
import { z } from "zod"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { parsePersonalIndexConnectionConfiguration } from "@/config/personal-index-provisioning"
import { syncTestProcessEnvironment } from "@/config/sync-test-runner"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import {
  COLLECTION_NAMES,
  type CollectionName,
  getCollection,
} from "@/lib/db/collections"
import {
  automaticIndexSpecs,
  INDEX_SPECS,
  type IndexSpec,
} from "@/lib/db/ensure-indexes"
import { readPlacementSyncIndexReadiness } from "@/lib/db/mixed-sync-index-readiness"
import {
  placementSyncIndexNameSchema,
  placementSyncIndexNames,
  placementSyncIndexReadinessSchema,
} from "@/schemas/placement-sync-index-provisioning"
import type { TaskPlacement } from "@/types/preferences"

const config = getSyncDatabaseTestConfig()
const target = config
  ? parsePersonalIndexConnectionConfiguration({
      mongodbUri: config.mongodbUri,
      databaseName: config.mongodbDatabase,
    })
  : null
const root = resolve(import.meta.dir, "../../..")
const actor = `placement-operator-${config?.runId}`
const ownedIndexes = new Map<string, IndexSpec>()
const ownedRecords = new Set<string>()
let freshDatabaseVerified = false
type PlacementDocument = TaskPlacement & { _id: string }

// Reject unexpected fields before assertions can expose raw subprocess output.
const receiptSchema = z.strictObject({
  status: z.enum(["ready", "failed"]),
  phase: z.enum([
    "configuration",
    "bootstrap",
    "database",
    "provision",
    "complete",
    "close",
  ]),
  connection: z.enum(["not_opened", "closed", "close_failed"]),
  provisioning: z
    .strictObject({
      status: z.enum([
        "ready",
        "blocked",
        "incomplete",
        "inspection_failed",
        "creation_failed",
      ]),
      created: z.array(placementSyncIndexNameSchema).max(4),
      readiness: placementSyncIndexReadinessSchema.nullable(),
      error: z
        .enum([
          "inspection_unavailable",
          "invalid_readiness",
          "duplicate_data",
          "definition_conflict",
          "creation_failed",
        ])
        .nullable(),
    })
    .nullable(),
})

async function ownedDatabase() {
  if (!config) throw new Error("Owned operator configuration is required")
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Operator database does not match its owned run")
  return database
}

async function inspectIndexes() {
  await ownedDatabase()
  return Promise.all(
    Object.values(COLLECTION_NAMES).map(async (name) => {
      try {
        const indexes = await (await getCollection(name))
          .listIndexes()
          .toArray()
        return {
          collection: name,
          indexes: indexes
            .filter((index) => index.name !== "_id_")
            .map((index) => ({
              name: index.name,
              key: index.key,
              unique: index.unique ?? false,
              partialFilterExpression: index.partialFilterExpression ?? null,
            }))
            .sort((left, right) =>
              String(left.name).localeCompare(String(right.name))
            ),
        }
      } catch (error) {
        if (error instanceof MongoServerError && error.code === 26)
          return { collection: name, indexes: [] }
        throw new Error("Owned index inspection failed")
      }
    })
  )
}

function expectedIndexes(specs: readonly IndexSpec[]) {
  return Object.values(COLLECTION_NAMES).map((collection) => ({
    collection,
    indexes: specs
      .filter((spec) => spec.collection === collection)
      .map((spec) => ({
        name: spec.options.name,
        key: spec.keys,
        unique: spec.options.unique ?? false,
        partialFilterExpression: spec.options.partialFilterExpression ?? null,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  }))
}

async function trackObservedIndexes() {
  if (!freshDatabaseVerified)
    throw new Error("Fresh ownership must precede tracking")
  for (const collection of await inspectIndexes())
    for (const index of collection.indexes) {
      const spec = INDEX_SPECS.find(
        (candidate) =>
          candidate.collection === collection.collection &&
          candidate.options.name === index.name
      )
      if (!spec) throw new Error("Owned database contains an unexpected index")
      ownedIndexes.set(spec.options.name, spec)
    }
}

async function dropTracked(specs: readonly IndexSpec[]) {
  if (!freshDatabaseVerified)
    throw new Error("Fresh ownership must precede index removal")
  for (const spec of specs) {
    if (!ownedIndexes.has(spec.options.name)) continue
    await (await getCollection(spec.collection as CollectionName)).dropIndex(
      spec.options.name
    )
    ownedIndexes.delete(spec.options.name)
  }
}

async function cleanOwnedRecords() {
  if (!freshDatabaseVerified || !ownedRecords.size) return
  await (
    await getCollection<PlacementDocument>(COLLECTION_NAMES.taskPlacements)
  ).deleteMany({
    _id: { $in: [...ownedRecords] },
    userId: actor,
  })
  ownedRecords.clear()
}

async function runCli(args?: string[], environment?: Record<string, string>) {
  if (!config || !target || !freshDatabaseVerified)
    throw new Error("CLI requires a verified owned configuration")
  const child = Bun.spawn(
    [
      process.execPath,
      "--no-env-file",
      "--conditions=react-server",
      "scripts/provision-placement-indexes.ts",
      ...(args ?? [
        "local",
        target.databaseName,
        target.mongodbAuthority,
        "--apply",
        "--acknowledge-automatic-bootstrap",
      ]),
    ],
    {
      cwd: root,
      env: environment ?? syncTestProcessEnvironment(config),
      stdout: "pipe",
      stderr: "pipe",
    }
  )
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    child.kill()
  }, 15000)
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    if (timedOut) throw new Error("Owned operator subprocess timed out")
    if (stderr || stdout.includes(config.mongodbUri))
      throw new Error("Owned operator output was not a sanitized receipt")
    let raw: unknown
    try {
      raw = JSON.parse(stdout)
    } catch {
      throw new Error("Owned operator did not emit one JSON receipt")
    }
    const parsed = receiptSchema.safeParse(raw)
    if (!parsed.success)
      throw new Error("Owned operator receipt was not finite")
    await trackObservedIndexes()
    return { receipt: parsed.data, exitCode }
  } finally {
    clearTimeout(timeout)
  }
}

function duplicatePlacement(occurrenceId: string): PlacementDocument {
  // Distinct raw identities deliberately collide only on the registered placement key.
  return {
    _id: crypto.randomUUID(),
    userId: actor,
    occurrenceId,
    scope: "day",
    date: "2026-10-09",
    tagId: null,
    position: 1024,
    revision: 1,
    createdAt: "2026-10-09T00:00:00.000Z",
    updatedAt: "2026-10-09T00:00:00.000Z",
    deletedAt: null,
  }
}

describe.skipIf(!config)("owned placement index operator CLI", () => {
  beforeAll(async () => {
    await ownedDatabase()
    for (const collection of Object.values(COLLECTION_NAMES))
      expect(await (await getCollection(collection)).countDocuments({})).toBe(0)
    expect(automaticIndexSpecs()).toHaveLength(9)
    expect(await inspectIndexes()).toEqual(
      expectedIndexes(automaticIndexSpecs())
    )
    expect(await readPlacementSyncIndexReadiness()).toEqual({
      ready: false,
      missing: [...placementSyncIndexNames],
      incompatible: [],
    })
    freshDatabaseVerified = true
    await trackObservedIndexes()
  }, 30000)

  beforeEach(async () => {
    if (!freshDatabaseVerified)
      throw new Error("Operator test requires fresh ownership proof")
    await cleanOwnedRecords()
    await dropTracked(
      INDEX_SPECS.filter((spec) => spec.provisioning === "explicit")
    )
  }, 30000)

  afterAll(async () => {
    try {
      if (freshDatabaseVerified) {
        await cleanOwnedRecords()
        await trackObservedIndexes()
        await dropTracked([...ownedIndexes.values()])
      }
    } finally {
      await closeDatabaseConnection()
    }
  }, 30000)

  test("invalid, implicit or mismatched targets do not recreate deliberately removed automatic indexes", async () => {
    if (!config || !target) throw new Error("Owned test configuration missing")
    await dropTracked(automaticIndexSpecs())
    const baseline = await inspectIndexes()
    expect(baseline.every((entry) => entry.indexes.length === 0)).toBe(true)
    const environment = syncTestProcessEnvironment(config)
    const { MONGODB_DB: _database, ...missingDatabaseEnvironment } = environment
    const flags = ["--apply", "--acknowledge-automatic-bootstrap"]
    for (const [args, env] of [
      [[], environment],
      [
        [
          "local",
          target.databaseName,
          target.mongodbAuthority,
          ...flags,
          "--unknown",
        ],
        environment,
      ],
      [
        ["local", target.databaseName, target.mongodbAuthority, ...flags],
        missingDatabaseEnvironment,
      ],
      [
        [
          "local",
          `${target.databaseName}-other`,
          target.mongodbAuthority,
          ...flags,
        ],
        environment,
      ],
      [
        ["local", target.databaseName, "localhost:27017", ...flags],
        environment,
      ],
    ] as const) {
      expect(await runCli([...args], env)).toEqual({
        exitCode: 1,
        receipt: {
          status: "failed",
          phase: "configuration",
          connection: "not_opened",
          provisioning: null,
        },
      })
      expect(await inspectIndexes()).toEqual(baseline)
      for (const collection of Object.values(COLLECTION_NAMES))
        expect(await (await getCollection(collection)).countDocuments({})).toBe(
          0
        )
    }
  }, 45000)

  test("the real default CLI bootstraps exactly automatic and four personal definitions, then becomes a no-op", async () => {
    await dropTracked(automaticIndexSpecs())
    const first = await runCli()
    expect(first).toEqual({
      exitCode: 0,
      receipt: {
        status: "ready",
        phase: "complete",
        connection: "closed",
        provisioning: {
          status: "ready",
          created: [...placementSyncIndexNames],
          readiness: { ready: true, missing: [], incompatible: [] },
          error: null,
        },
      },
    })
    const baseline = await inspectIndexes()
    expect(baseline).toEqual(expectedIndexes(INDEX_SPECS))
    expect(await runCli()).toEqual({
      exitCode: 0,
      receipt: {
        status: "ready",
        phase: "complete",
        connection: "closed",
        provisioning: {
          status: "ready",
          created: [],
          readiness: { ready: true, missing: [], incompatible: [] },
          error: null,
        },
      },
    })
    expect(await inspectIndexes()).toEqual(baseline)
    for (const collection of Object.values(COLLECTION_NAMES))
      expect(await (await getCollection(collection)).countDocuments({})).toBe(0)
  }, 45000)

  test("duplicate data preserves the real successful prefix and records, and explicit fixture removal retries only the missing index", async () => {
    const collection = await getCollection<PlacementDocument>(
      COLLECTION_NAMES.taskPlacements
    )
    const occurrenceId = crypto.randomUUID()
    const records = [
      duplicatePlacement(occurrenceId),
      duplicatePlacement(occurrenceId),
    ]
    for (const record of records) ownedRecords.add(record._id)
    await collection.insertMany(records)
    const before = await collection
      .find({ userId: actor })
      .sort({ _id: 1 })
      .toArray()
    const prefix = placementSyncIndexNames.slice(0, 3)
    const placement = placementSyncIndexNames[3]
    expect(await runCli()).toEqual({
      exitCode: 1,
      receipt: {
        status: "failed",
        phase: "provision",
        connection: "closed",
        provisioning: {
          status: "creation_failed",
          created: prefix,
          readiness: { ready: false, missing: [placement], incompatible: [] },
          error: "duplicate_data",
        },
      },
    })
    expect(
      await collection.find({ userId: actor }).sort({ _id: 1 }).toArray()
    ).toEqual(before)
    expect(await readPlacementSyncIndexReadiness()).toEqual({
      ready: false,
      missing: [placement],
      incompatible: [],
    })
    expect(
      (await collection.deleteOne({ _id: records[1]._id, userId: actor }))
        .deletedCount
    ).toBe(1)
    expect(await runCli()).toEqual({
      exitCode: 0,
      receipt: {
        status: "ready",
        phase: "complete",
        connection: "closed",
        provisioning: {
          status: "ready",
          created: [placement],
          readiness: { ready: true, missing: [], incompatible: [] },
          error: null,
        },
      },
    })
    expect(await collection.find({ userId: actor }).toArray()).toEqual([
      records[0],
    ])
    expect(await inspectIndexes()).toEqual(expectedIndexes(INDEX_SPECS))
  }, 45000)
})
