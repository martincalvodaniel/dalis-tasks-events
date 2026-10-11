import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { RemotePlanOccurrenceRepository } from "@/lib/db/remote-plan-occurrences"
import { writeRemotePlanSeriesGuard } from "@/lib/db/remote-plan-series-guard"
import type { Plan } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"

const config = getSyncDatabaseTestConfig()
const prefix = `remote-series-guard-${config?.runId}-`
const seriesId = "00000000-0000-4000-8000-000000000001"
const otherSeriesId = "00000000-0000-4000-8000-000000000002"
const now = "2026-10-11T09:00:00.000Z"
const later = "2026-10-11T10:00:00.000Z"

async function ownedDatabase() {
  if (!config) throw new Error("Sync test configuration is required")
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Series guard test database does not match its owned run")
  return database
}
async function guards() {
  return getCollection<{ _id: string; [key: string]: unknown }>(
    COLLECTION_NAMES.planSeriesGuards
  )
}
function parent(ownerId: string, id = seriesId): Plan {
  return {
    kind: "plan",
    variant: "task",
    id,
    ownerId,
    title: "Recurring race",
    description: "",
    status: "not_started",
    checklist: [],
    completedAt: null,
    schedule: {
      mode: "all_day",
      startDate: "2026-10-11",
      endDateExclusive: "2026-10-12",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-11",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}
function appearance(parentId = seriesId): PlanOccurrence {
  return {
    kind: "plan",
    id: `${parentId}:2026-10-11`,
    seriesId: parentId,
    slotKey: "2026-10-11",
    schedule: {
      mode: "all_day",
      startDate: "2026-10-11",
      endDateExclusive: "2026-10-12",
    },
    content: { title: "Appearance race", description: "" },
    status: "not_started",
    completedAt: null,
    checklist: [],
    cancelled: false,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}

describe.skipIf(!config)("prepared shared series write guard", () => {
  beforeAll(async () => {
    await ensureIndexes(
      await ownedDatabase(),
      INDEX_SPECS.filter(
        (spec) => spec.collection === COLLECTION_NAMES.planOccurrences
      )
    )
  }, 30000)
  afterAll(async () => {
    try {
      await ownedDatabase()
      for (const [name, field] of [
        [COLLECTION_NAMES.items, "ownerId"],
        [COLLECTION_NAMES.planOccurrences, "userId"],
        [COLLECTION_NAMES.planSeriesGuards, "userId"],
      ] as const)
        await (await getCollection(name)).deleteMany({
          [field]: { $regex: `^${prefix}` },
        })
    } finally {
      await closeDatabaseConnection()
    }
  }, 30000)

  test("requires a transaction, isolates actor and series, writes a new token and rolls back", async () => {
    const database = await ownedDatabase()
    const actor = `${prefix}isolation`
    const raw = await guards()
    const id = JSON.stringify([actor, seriesId])
    await database.client.withSession(async (session) => {
      await expect(
        writeRemotePlanSeriesGuard(actor, seriesId, session)
      ).rejects.toThrow("active transaction")
      expect(await raw.findOne({ _id: id })).toBeNull()
      await session.withTransaction(async () => {
        await writeRemotePlanSeriesGuard(actor, seriesId, session)
        expect(await raw.findOne({ _id: id })).toBeNull()
      })
    })
    const initial = await raw.findOne({ _id: id })
    expect(initial).toMatchObject({ userId: actor, seriesId })
    await expect(
      database.client.withSession((session) =>
        session.withTransaction(async () => {
          await writeRemotePlanSeriesGuard(actor, seriesId, session)
          const changed = await raw.findOne({ _id: id }, { session })
          expect(changed?.token).not.toBe(initial?.token)
          throw new Error("Owned guard rollback")
        })
      )
    ).rejects.toThrow("Owned guard rollback")
    expect(await raw.findOne({ _id: id })).toEqual(initial)
    await database.client.withSession((session) =>
      session.withTransaction(async () => {
        await writeRemotePlanSeriesGuard(actor, seriesId, session)
        await writeRemotePlanSeriesGuard(actor, otherSeriesId, session)
        await writeRemotePlanSeriesGuard(`${prefix}other`, seriesId, session)
      })
    )
    expect((await raw.findOne({ _id: id }))?.token).not.toBe(initial?.token)
    expect(await raw.countDocuments({ userId: actor })).toBe(2)
    expect(await raw.countDocuments({ userId: `${prefix}other` })).toBe(1)
  }, 30000)

  test("rejects corrupt guard identity and metadata without replacing them", async () => {
    const database = await ownedDatabase()
    const actor = `${prefix}corrupt`
    const raw = await guards()
    const id = JSON.stringify([actor, seriesId])
    const valid = {
      _id: id,
      userId: actor,
      seriesId,
      token: crypto.randomUUID(),
    }
    for (const changes of [
      { userId: `${prefix}other` },
      { seriesId: otherSeriesId },
      { token: "invalid" },
      { extra: true },
    ]) {
      const corrupted = { ...valid, ...changes }
      await raw.replaceOne({ _id: id }, corrupted, { upsert: true })
      await expect(
        database.client.withSession((session) =>
          session.withTransaction(() =>
            writeRemotePlanSeriesGuard(actor, seriesId, session)
          )
        )
      ).rejects.toThrow()
      expect(await raw.findOne({ _id: id })).toEqual(corrupted)
    }
    await raw.replaceOne({ _id: id }, valid)
    expect(await raw.findOne({ _id: id })).toEqual(valid)
  }, 30000)

  test("retries a stale appearance snapshot after guarded parent edits or deletion, without creating it", async () => {
    const database = await ownedDatabase()
    for (const mutation of ["edit", "delete"] as const) {
      const raceSeriesId = mutation === "edit" ? seriesId : otherSeriesId
      const actor = `${prefix}race-${mutation}`
      const items = await RemoteItemRepository.open(actor)
      const original = parent(actor, raceSeriesId)
      expect(await items.insert(original)).toBe(true)
      await database.client.withSession((session) =>
        session.withTransaction(() =>
          writeRemotePlanSeriesGuard(actor, raceSeriesId, session)
        )
      )
      const entered = Promise.withResolvers<void>()
      const release = Promise.withResolvers<void>()
      const revisions: number[] = []
      let paused = false
      const pending = database.client.withSession((session) =>
        session.withTransaction(
          async () => {
            const txItems = await RemoteItemRepository.open(actor, session)
            const current = await txItems.read(raceSeriesId)
            if (!current) throw new Error("Expected own recurring parent")
            revisions.push(current.revision)
            if (current.deletedAt !== null || current.revision !== 1)
              return false
            if (!paused) {
              paused = true
              entered.resolve()
              await release.promise
            }
            await writeRemotePlanSeriesGuard(actor, raceSeriesId, session)
            const txAppearances = await RemotePlanOccurrenceRepository.open(
              actor,
              session
            )
            return txAppearances.insert(appearance(raceSeriesId))
          },
          {
            readConcern: { level: "snapshot" },
            writeConcern: { w: "majority" },
            timeoutMS: 15000,
          }
        )
      )
      try {
        await Promise.race([
          entered.promise,
          pending.then(() => {
            throw new Error(
              "Appearance completed before its controlled snapshot"
            )
          }),
        ])
        await database.client.withSession((session) =>
          session.withTransaction(async () => {
            await writeRemotePlanSeriesGuard(actor, raceSeriesId, session)
            const txItems = await RemoteItemRepository.open(actor, session)
            expect(
              await txItems.replace(1, {
                ...original,
                revision: 2,
                updatedAt: later,
                ...(mutation === "delete"
                  ? { deletedAt: later }
                  : { title: "Parent changed" }),
              })
            ).toBe(true)
          })
        )
      } finally {
        release.resolve()
      }
      expect(await pending).toBe(false)
      expect(revisions).toEqual([1, 2])
      const actual = await items.read(raceSeriesId)
      expect(actual?.revision).toBe(2)
      expect(actual?.deletedAt).toBe(mutation === "delete" ? later : null)
      const stored = await RemotePlanOccurrenceRepository.open(actor)
      expect(
        await stored.read({
          seriesId: raceSeriesId,
          id: appearance(raceSeriesId).id,
        })
      ).toBeNull()
      expect(await stored.seriesCatalog(raceSeriesId)).toEqual([])
    }
  }, 30000)
})
