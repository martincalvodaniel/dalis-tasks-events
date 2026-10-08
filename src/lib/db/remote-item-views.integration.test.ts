import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { RemoteItemViewRepository } from "@/lib/db/remote-item-views"
import type { ItemView } from "@/types/preferences"

const config = getSyncDatabaseTestConfig()
const actorPrefix = `remote-item-views-${config?.runId}-`
const timestamp = "2026-10-08T00:00:00.000Z"
const later = "2026-10-08T00:00:01.000Z"
function view(userId: string, itemId = crypto.randomUUID()): ItemView {
  return {
    userId,
    itemId,
    primaryTagId: null,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
}
async function assertOwnedDatabase() {
  if (!config) throw new Error("Sync test configuration is required")
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("View test database does not match its owned run")
  return database
}

describe.skipIf(!config)("owned remote personal views", () => {
  beforeAll(async () => {
    const database = await assertOwnedDatabase()
    const staged = INDEX_SPECS.filter(
      (spec) => spec.collection === COLLECTION_NAMES.itemViews
    )
    expect(staged).toHaveLength(1)
    expect(staged[0].provisioning).toBe("explicit")
    await ensureIndexes(database, staged)
  }, 30000)

  afterAll(async () => {
    try {
      await assertOwnedDatabase()
      await (await getCollection(COLLECTION_NAMES.itemViews)).deleteMany({
        userId: { $regex: `^${actorPrefix}` },
      })
    } finally {
      await closeDatabaseConnection()
    }
  }, 30000)

  test("isolates the same item UUID across actors and validates ownership and metadata", async () => {
    const first = view(`${actorPrefix}first`)
    const second = {
      ...view(`${actorPrefix}second`, first.itemId),
      primaryTagId: crypto.randomUUID(),
    }
    const own = await RemoteItemViewRepository.open(first.userId)
    const other = await RemoteItemViewRepository.open(second.userId)
    expect(await own.insert(first)).toBe(true)
    expect(await other.read(first.itemId)).toBeNull()
    expect(await other.insert(second)).toBe(true)
    expect(await own.read(first.itemId)).toEqual(first)
    expect(await other.read(first.itemId)).toEqual(second)
    expect(
      await own.insert({ ...first, primaryTagId: second.primaryTagId })
    ).toBe(false)
    await expect(own.insert(view(second.userId))).rejects.toThrow()
    await expect(own.replace(1, { ...second, revision: 2 })).rejects.toThrow()
    await expect(own.read("invalid")).rejects.toThrow()
    await expect(
      own.insert({ ...view(first.userId), primaryTagId: "invalid" })
    ).rejects.toThrow()
    await expect(
      own.insert({ ...view(first.userId), revision: 0 })
    ).rejects.toThrow()
    await expect(
      own.insert({ ...view(first.userId), revision: 2 })
    ).rejects.toThrow()
    await expect(
      own.insert({ ...view(first.userId), updatedAt: later })
    ).rejects.toThrow()
    await expect(
      own.insert({ ...view(first.userId), deletedAt: timestamp })
    ).rejects.toThrow()
    await expect(own.replace(0, first)).rejects.toThrow()
    await expect(own.replace(1, { ...first, revision: 3 })).rejects.toThrow()
    expect(
      await own.replace(1, {
        ...first,
        revision: 2,
        createdAt: later,
        updatedAt: later,
      })
    ).toBe(false)
    expect(await own.read(first.itemId)).toEqual(first)
  }, 30000)

  test("allows one CAS winner, clears the category and preserves a non-restorable tombstone", async () => {
    const initial = view(`${actorPrefix}cas`)
    const own = await RemoteItemViewRepository.open(initial.userId)
    expect(await own.insert(initial)).toBe(true)
    const next = { ...initial, revision: 2, updatedAt: later }
    const results = await Promise.all([
      own.replace(1, { ...next, primaryTagId: crypto.randomUUID() }),
      own.replace(1, { ...next, primaryTagId: crypto.randomUUID() }),
    ])
    expect(results.toSorted()).toEqual([false, true])
    const winner = await own.read(initial.itemId)
    if (!winner) throw new Error("Expected personal view CAS winner")
    expect(winner.revision).toBe(2)
    expect(winner.primaryTagId).not.toBeNull()
    const cleared = { ...winner, primaryTagId: null, revision: 3 }
    expect(await own.replace(2, cleared)).toBe(true)
    expect(await own.read(initial.itemId)).toEqual(cleared)
    const tombstone = { ...cleared, revision: 4, deletedAt: later }
    expect(await own.replace(3, tombstone)).toBe(true)
    expect(await own.read(initial.itemId)).toEqual(tombstone)
    expect(await own.replace(4, { ...cleared, revision: 5 })).toBe(false)
    expect(await own.insert(initial)).toBe(false)
    expect(await own.read(initial.itemId)).toEqual(tombstone)
  }, 30000)

  test("rejects stored corruption and inconsistent compound identity", async () => {
    const initial = view(`${actorPrefix}corrupt`)
    const own = await RemoteItemViewRepository.open(initial.userId)
    expect(await own.insert(initial)).toBe(true)
    const collection = await getCollection<{
      _id: string
      [key: string]: unknown
    }>(COLLECTION_NAMES.itemViews)
    const stored = {
      ...initial,
      _id: JSON.stringify([initial.userId, initial.itemId]),
    }
    for (const corruption of [
      { revision: 0 },
      { primaryTagId: "invalid" },
      { itemId: crypto.randomUUID() },
    ]) {
      await collection.updateOne({ _id: stored._id }, { $set: corruption })
      try {
        const requestedId =
          "itemId" in corruption && typeof corruption.itemId === "string"
            ? corruption.itemId
            : initial.itemId
        await expect(own.read(requestedId)).rejects.toThrow()
      } finally {
        await collection.replaceOne({ _id: stored._id }, stored)
      }
    }
    expect(await own.read(initial.itemId)).toEqual(initial)
  }, 30000)

  test("shares the supplied transaction for reads and writes and rolls back after late failure", async () => {
    const database = await assertOwnedDatabase()
    const existing = view(`${actorPrefix}rollback`)
    const fresh = view(existing.userId)
    const own = await RemoteItemViewRepository.open(existing.userId)
    expect(await own.insert(existing)).toBe(true)
    await expect(
      database.client.withSession(async (session) =>
        session.withTransaction(async () => {
          const transaction = await RemoteItemViewRepository.open(
            existing.userId,
            session
          )
          expect(await transaction.insert(fresh)).toBe(true)
          expect(
            await transaction.replace(1, {
              ...existing,
              primaryTagId: crypto.randomUUID(),
              revision: 2,
              updatedAt: later,
            })
          ).toBe(true)
          expect(await transaction.read(fresh.itemId)).toEqual(fresh)
          expect((await transaction.read(existing.itemId))?.revision).toBe(2)
          expect(await own.read(fresh.itemId)).toBeNull()
          expect(await own.read(existing.itemId)).toEqual(existing)
          throw new Error("Intentional personal view transaction abort")
        })
      )
    ).rejects.toThrow("Intentional personal view transaction abort")
    expect(await own.read(fresh.itemId)).toBeNull()
    expect(await own.read(existing.itemId)).toEqual(existing)
    await expect(
      database.client.withSession(async (session) =>
        session.withTransaction(async () => {
          const transaction = await RemoteItemViewRepository.open(
            existing.userId,
            session
          )
          await transaction.insert(fresh)
          await transaction.insert(existing)
        })
      )
    ).rejects.toThrow()
    expect(await own.read(fresh.itemId)).toBeNull()
    expect(await own.read(existing.itemId)).toEqual(existing)
  }, 30000)
})
