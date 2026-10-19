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
  ensureIndexes,
  INDEX_SPECS,
  type IndexSpec,
} from "@/lib/db/ensure-indexes"
import { readRecurringSyncIndexReadiness } from "@/lib/db/mixed-sync-index-readiness"
import {
  recurringSyncIndexNameSchema,
  recurringSyncIndexNames,
  recurringSyncIndexReadinessSchema,
} from "@/schemas/recurring-sync-index-provisioning"
import type { PlanOccurrence } from "@/types/plan-occurrence"

const config = getSyncDatabaseTestConfig()
const target = config
  ? parsePersonalIndexConnectionConfiguration({
      mongodbUri: config.mongodbUri,
      databaseName: config.mongodbDatabase,
    })
  : null
const root = resolve(import.meta.dir, "../../..")
const actor = `recurring-operator-${config?.runId}`
const ownedIndexes = new Map<string, IndexSpec>()
const ownedRecords = new Set<string>()
let freshDatabaseVerified = false
type RecurringDocument = PlanOccurrence & { _id: string; userId: string }

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
      created: z.array(recurringSyncIndexNameSchema).max(5),
      readiness: recurringSyncIndexReadinessSchema.nullable(),
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
    await getCollection<RecurringDocument>(COLLECTION_NAMES.planOccurrences)
  ).deleteMany({
    _id: { $in: [...ownedRecords] },
    userId: actor,
  })
  await (
    await getCollection<{ _id: string; userId: string }>(
      COLLECTION_NAMES.userSettings
    )
  ).deleteMany({ _id: { $in: [...ownedRecords] }, userId: actor })
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
      "scripts/provision-recurring-indexes.ts",
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

async function runWebBootstrap(environment: string, branch: string) {
  if (!config || !freshDatabaseVerified)
    throw new Error("Web bootstrap requires a verified owned database")
  const child = Bun.spawn(
    [
      process.execPath,
      "--no-env-file",
      "--conditions=react-server",
      "-e",
      `
      import { getDatabase, closeDatabaseConnection } from "./src/lib/db/client.ts";
      let result = { ready: false, closed: false, code: null };
      try { await getDatabase(); result.ready = true; }
      catch (error) { result.code = typeof error?.code === "number" ? error.code : null; }
      finally { await closeDatabaseConnection(); result.closed = true; }
      console.log(JSON.stringify(result));
    `,
    ],
    {
      cwd: root,
      env: {
        ...syncTestProcessEnvironment(config),
        NODE_ENV:
          environment === "development"
            ? "development"
            : environment
              ? "production"
              : "test",
        VERCEL_ENV: environment,
        VERCEL_GIT_COMMIT_REF: branch,
      },
      stdout: "pipe",
      stderr: "pipe",
    }
  )
  const timeout = setTimeout(() => child.kill(), 15000)
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    if (exitCode !== 0 || stderr || stdout.includes(config.mongodbUri))
      throw new Error("Web bootstrap did not return a sanitized result")
    const result = z
      .strictObject({
        ready: z.boolean(),
        closed: z.boolean(),
        code: z.number().nullable(),
      })
      .parse(JSON.parse(stdout))
    await trackObservedIndexes()
    return result
  } finally {
    clearTimeout(timeout)
  }
}

function duplicateRecurring(seriesId: string): RecurringDocument {
  // Distinct raw identities collide only on the registered appearance key.
  return {
    _id: crypto.randomUUID(),
    userId: actor,
    kind: "plan",
    id: `${seriesId}:2026-10-12`,
    seriesId,
    slotKey: "2026-10-12",
    schedule: {
      mode: "all_day",
      startDate: "2026-10-12",
      endDateExclusive: "2026-10-13",
    },
    status: "not_started",
    checklist: [],
    completedAt: null,
    cancelled: false,
    revision: 1,
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
    deletedAt: null,
  }
}

describe.skipIf(!config)("owned recurring index operator CLI", () => {
  beforeAll(async () => {
    await ownedDatabase()
    for (const collection of Object.values(COLLECTION_NAMES))
      expect(await (await getCollection(collection)).countDocuments({})).toBe(0)
    expect(automaticIndexSpecs()).toHaveLength(15)
    expect(await inspectIndexes()).toEqual(
      expectedIndexes(automaticIndexSpecs())
    )
    expect(await readRecurringSyncIndexReadiness()).toEqual({
      ready: true,
      missing: [],
      incompatible: [],
    })
    freshDatabaseVerified = true
    await trackObservedIndexes()
  }, 30000)

  beforeEach(async () => {
    if (!freshDatabaseVerified)
      throw new Error("Operator test requires fresh ownership proof")
    await cleanOwnedRecords()
    await dropTracked(INDEX_SPECS)
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

  test("every web environment and branch creates the complete registry from scratch and retries idempotently", async () => {
    const expected = expectedIndexes(INDEX_SPECS)
    for (const [environment, branch] of [
      ["production", "main"],
      ["production", "int"],
      ["preview", "main"],
      ["preview", "int"],
      ["development", "feature"],
      ["", ""],
    ]) {
      await dropTracked(INDEX_SPECS)
      expect(await runWebBootstrap(environment, branch)).toEqual({
        ready: true,
        closed: true,
        code: null,
      })
      expect(await inspectIndexes()).toEqual(expected)
      expect(await runWebBootstrap(environment, branch)).toEqual({
        ready: true,
        closed: true,
        code: null,
      })
      expect(await inspectIndexes()).toEqual(expected)
    }
    const collection = await getCollection<RecurringDocument>(
      COLLECTION_NAMES.planOccurrences
    )
    const first = duplicateRecurring(crypto.randomUUID())
    ownedRecords.add(first._id)
    await collection.insertOne(first)
    const duplicate = { ...first, _id: crypto.randomUUID() }
    await expect(collection.insertOne(duplicate)).rejects.toMatchObject({
      code: 11000,
    })
    expect(await collection.find({ userId: actor }).toArray()).toEqual([first])
  }, 45000)

  test("production upgrades a populated base registry without changing existing documents", async () => {
    const database = await ownedDatabase()
    await ensureIndexes(
      database,
      INDEX_SPECS.filter((spec) => spec.provisioning !== "explicit")
    )
    await trackObservedIndexes()
    const occurrence = duplicateRecurring(crypto.randomUUID())
    const settings = {
      _id: crypto.randomUUID(),
      userId: actor,
      timeZone: "Europe/Madrid",
    }
    ownedRecords.add(occurrence._id)
    ownedRecords.add(settings._id)
    const occurrences = await getCollection<RecurringDocument>(
      COLLECTION_NAMES.planOccurrences
    )
    const preferences = await getCollection<typeof settings>(
      COLLECTION_NAMES.userSettings
    )
    await occurrences.insertOne(occurrence)
    await preferences.insertOne(settings)
    expect(await runWebBootstrap("production", "main")).toEqual({
      ready: true,
      closed: true,
      code: null,
    })
    expect(await inspectIndexes()).toEqual(expectedIndexes(INDEX_SPECS))
    expect(await occurrences.find({ userId: actor }).toArray()).toEqual([
      occurrence,
    ])
    expect(await preferences.find({ userId: actor }).toArray()).toEqual([
      settings,
    ])
    expect(await runWebBootstrap("production", "main")).toEqual({
      ready: true,
      closed: true,
      code: null,
    })
    expect(await occurrences.find({ userId: actor }).toArray()).toEqual([
      occurrence,
    ])
    expect(await preferences.find({ userId: actor }).toArray()).toEqual([
      settings,
    ])
  }, 30000)

  test("the public ensure-indexes command uses the same complete bootstrap", async () => {
    if (!config) throw new Error("Owned test configuration is required")
    const child = Bun.spawn(
      [process.execPath, "--no-env-file", "run", "db:ensure-indexes"],
      {
        cwd: root,
        env: syncTestProcessEnvironment(config),
        stdout: "pipe",
        stderr: "pipe",
      }
    )
    const timeout = setTimeout(() => child.kill(), 15000)
    try {
      const [exitCode, stdout] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      expect(exitCode).toBe(0)
      expect(stdout.trim()).toBe("Database indexes ensured.")
      await trackObservedIndexes()
      expect(await inspectIndexes()).toEqual(expectedIndexes(INDEX_SPECS))
    } finally {
      clearTimeout(timeout)
    }
  }, 30000)

  test("settings duplicates stop production bootstrap without deleting or correcting records", async () => {
    const collection = await getCollection<{
      _id: string
      userId: string
      timeZone: string
    }>(COLLECTION_NAMES.userSettings)
    const records = [
      { _id: crypto.randomUUID(), userId: actor, timeZone: "Europe/Madrid" },
      { _id: crypto.randomUUID(), userId: actor, timeZone: "Asia/Tokyo" },
    ]
    for (const record of records) ownedRecords.add(record._id)
    await collection.insertMany(records)
    const before = await collection
      .find({ userId: actor })
      .sort({ _id: 1 })
      .toArray()
    expect(await runWebBootstrap("production", "main")).toEqual({
      ready: false,
      closed: true,
      code: 11000,
    })
    expect(
      await collection.find({ userId: actor }).sort({ _id: 1 }).toArray()
    ).toEqual(before)
    expect(await inspectIndexes()).toEqual(expectedIndexes([INDEX_SPECS[0]]))
  }, 30000)

  test("settings incompatible definition is preserved after earlier bootstrap indexes", async () => {
    const database = await ownedDatabase(),
      spec = INDEX_SPECS[1]
    await ensureIndexes(database, [{ ...spec, keys: { timeZone: 1 } }])
    await trackObservedIndexes()
    const result = await runWebBootstrap("production", "main")
    expect(result.ready).toBe(false)
    expect(result.closed).toBe(true)
    expect(result.code !== null && [85, 86].includes(result.code)).toBe(true)
    expect(await inspectIndexes()).toEqual(
      expectedIndexes([INDEX_SPECS[0], { ...spec, keys: { timeZone: 1 } }])
    )
  }, 30000)

  test("production startup preserves duplicate records and stops without repairing data", async () => {
    const collection = await getCollection<RecurringDocument>(
      COLLECTION_NAMES.planOccurrences
    )
    const series = crypto.randomUUID()
    const records = [duplicateRecurring(series), duplicateRecurring(series)]
    for (const record of records) ownedRecords.add(record._id)
    await collection.insertMany(records)
    const before = await collection
      .find({ userId: actor })
      .sort({ _id: 1 })
      .toArray()
    expect(await runWebBootstrap("production", "main")).toEqual({
      ready: false,
      closed: true,
      code: 11000,
    })
    expect(
      await collection.find({ userId: actor }).sort({ _id: 1 }).toArray()
    ).toEqual(before)
    expect(await inspectIndexes()).toEqual(expectedIndexes([]))
  }, 30000)

  test("production startup refuses an incompatible registered name without replacing it", async () => {
    const database = await ownedDatabase()
    const spec = INDEX_SPECS[0]
    await ensureIndexes(database, [{ ...spec, keys: { userId: 1 } }])
    await trackObservedIndexes()
    const before = await inspectIndexes()
    const result = await runWebBootstrap("production", "main")
    expect(result.ready).toBe(false)
    expect(result.closed).toBe(true)
    expect(result.code !== null && [85, 86].includes(result.code)).toBe(true)
    expect(await inspectIndexes()).toEqual(before)
    expect(
      await (
        await getCollection(COLLECTION_NAMES.planOccurrences)
      ).countDocuments({})
    ).toBe(0)
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

  test("the real CLI bootstraps the full registry before its scoped no-op inspection", async () => {
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
          created: [],
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

  test("bootstrap failure preserves duplicate records and retries after explicit owned fixture removal", async () => {
    const collection = await getCollection<RecurringDocument>(
      COLLECTION_NAMES.planOccurrences
    )
    const occurrenceId = crypto.randomUUID()
    const records = [
      duplicateRecurring(occurrenceId),
      duplicateRecurring(occurrenceId),
    ]
    for (const record of records) ownedRecords.add(record._id)
    await collection.insertMany(records)
    const before = await collection
      .find({ userId: actor })
      .sort({ _id: 1 })
      .toArray()
    expect(await runCli()).toEqual({
      exitCode: 1,
      receipt: {
        status: "failed",
        phase: "bootstrap",
        connection: "closed",
        provisioning: null,
      },
    })
    expect(
      await collection.find({ userId: actor }).sort({ _id: 1 }).toArray()
    ).toEqual(before)
    expect(await readRecurringSyncIndexReadiness()).toEqual({
      ready: false,
      missing: [...recurringSyncIndexNames],
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
          created: [],
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
