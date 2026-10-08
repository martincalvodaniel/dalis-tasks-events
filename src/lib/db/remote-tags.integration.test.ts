import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { RemoteTagRepository } from "@/lib/db/remote-tags"
import { maximumRemoteTags } from "@/schemas/remote-tag-planning"
import type { Tag } from "@/types/preferences"

const config = getSyncDatabaseTestConfig()
const actorPrefix = `remote-tags-${config?.runId}-`
const timestamp = "2026-10-08T00:00:00.000Z"
const later = "2026-10-08T00:00:01.000Z"
function category(
  userId: string,
  name = "Test category",
  id = crypto.randomUUID()
): Tag {
  return {
    id,
    userId,
    name,
    normalizedName: name.normalize("NFKC").toLowerCase(),
    color: "#123456",
    position: 1024,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
}
function document(tag: Tag) {
  return { ...tag, _id: JSON.stringify([tag.userId, tag.id]) }
}
async function assertOwnedDatabase() {
  if (!config) throw new Error("Sync test configuration is required")
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Category test database does not match its owned run")
  return database
}

describe.skipIf(!config)("owned remote categories", () => {
  beforeAll(async () => {
    const database = await assertOwnedDatabase()
    const staged = INDEX_SPECS.filter(
      (spec) => spec.collection === COLLECTION_NAMES.tags
    )
    expect(staged).toHaveLength(2)
    expect(staged.every((spec) => spec.provisioning === "explicit")).toBe(true)
    await ensureIndexes(database, staged)
  }, 30000)

  afterAll(async () => {
    try {
      await assertOwnedDatabase()
      await (await getCollection(COLLECTION_NAMES.tags)).deleteMany({
        userId: { $regex: `^${actorPrefix}` },
      })
    } finally {
      await closeDatabaseConnection()
    }
  }, 30000)

  test("isolates actors with the same UUID and name, rejecting unsafe writes", async () => {
    const first = category(`${actorPrefix}first`)
    const second = category(`${actorPrefix}second`, first.name, first.id)
    const own = await RemoteTagRepository.open(first.userId)
    const other = await RemoteTagRepository.open(second.userId)
    expect(await own.insert(first)).toBe(true)
    expect(await other.read(first.id)).toBeNull()
    expect(await other.insert(second)).toBe(true)
    expect(await own.read(first.id)).toEqual(first)
    expect(await other.read(first.id)).toEqual(second)
    expect(await own.catalog()).toEqual([first])
    expect(await other.catalog()).toEqual([second])
    expect(await own.insert({ ...first, color: "#654321" })).toBe(false)
    await expect(own.insert(category(second.userId))).rejects.toThrow()
    await expect(
      own.insert({ ...category(first.userId, "Wrong revision"), revision: 2 })
    ).rejects.toThrow()
    await expect(
      own.insert({ ...category(first.userId, "Wrong date"), updatedAt: later })
    ).rejects.toThrow()
    await expect(
      own.insert({
        ...category(first.userId, "Already deleted"),
        deletedAt: timestamp,
      })
    ).rejects.toThrow()
    await expect(own.replace(0, { ...first, revision: 1 })).rejects.toThrow()
    await expect(own.replace(1, { ...first, revision: 3 })).rejects.toThrow()
    expect(
      await own.replace(1, {
        ...first,
        revision: 2,
        createdAt: later,
        updatedAt: later,
      })
    ).toBe(false)
    expect(await own.read(first.id)).toEqual(first)
  }, 30000)

  test("allows exactly one CAS winner and preserves tombstones while reusing a name", async () => {
    const initial = category(`${actorPrefix}cas`)
    const own = await RemoteTagRepository.open(initial.userId)
    expect(await own.insert(initial)).toBe(true)
    const next = { ...initial, revision: 2, updatedAt: later }
    const results = await Promise.all([
      own.replace(1, { ...next, color: "#654321" }),
      own.replace(1, { ...next, color: "#abcdef" }),
    ])
    expect(results.toSorted()).toEqual([false, true])
    const winner = await own.read(initial.id)
    if (!winner) throw new Error("Expected CAS winner")
    expect(winner.revision).toBe(2)
    const tombstone = {
      ...winner,
      revision: 3,
      updatedAt: later,
      deletedAt: later,
    }
    expect(await own.replace(2, tombstone)).toBe(true)
    expect(await own.read(initial.id)).toEqual(tombstone)
    expect(await own.replace(3, { ...winner, revision: 4 })).toBe(false)
    expect(await own.insert(initial)).toBe(false)
    const replacement = category(initial.userId, initial.name)
    expect(await own.insert(replacement)).toBe(true)
    const catalog = await own.catalog()
    expect(catalog).toHaveLength(2)
    expect(catalog.find((tag) => tag.id === initial.id)).toEqual(tombstone)
    expect(catalog.find((tag) => tag.id === replacement.id)).toEqual(
      replacement
    )
  }, 30000)

  test("enforces active normalized name uniqueness under races and replacement", async () => {
    const initial = category(`${actorPrefix}name-race`, "Shared name")
    const sameName = category(initial.userId, "SHARED NAME")
    const own = await RemoteTagRepository.open(initial.userId)
    const results = await Promise.allSettled([
      own.insert(initial),
      own.insert(sameName),
    ])
    expect(
      results.filter(
        (result) => result.status === "fulfilled" && result.value === true
      )
    ).toHaveLength(1)
    expect(
      results.filter((result) => result.status === "rejected")
    ).toHaveLength(1)
    const winner = (await own.catalog())[0]
    expect(winner.normalizedName).toBe("shared name")
    const distinct = category(initial.userId, "Distinct name")
    expect(await own.insert(distinct)).toBe(true)
    await expect(
      own.replace(1, {
        ...distinct,
        name: winner.name,
        normalizedName: winner.normalizedName,
        revision: 2,
        updatedAt: later,
      })
    ).rejects.toThrow()
    expect(await own.read(distinct.id)).toEqual(distinct)
    expect(await own.catalog()).toHaveLength(2)
  }, 30000)

  test("rejects corrupt records on reads and whole catalog without partial output", async () => {
    const initial = category(`${actorPrefix}corrupt`)
    const own = await RemoteTagRepository.open(initial.userId)
    expect(await own.insert(initial)).toBe(true)
    const collection = await getCollection<{
      _id: string
      [key: string]: unknown
    }>(COLLECTION_NAMES.tags)
    const stored = document(initial)
    for (const corruption of [
      { revision: 0 },
      { normalizedName: "wrong" },
      { id: crypto.randomUUID() },
      { color: 123 },
    ]) {
      await collection.updateOne({ _id: stored._id }, { $set: corruption })
      try {
        const requestedId =
          "id" in corruption && typeof corruption.id === "string"
            ? corruption.id
            : initial.id
        await expect(own.read(requestedId)).rejects.toThrow()
        await expect(own.catalog()).rejects.toThrow()
      } finally {
        await collection.replaceOne({ _id: stored._id }, stored)
      }
    }
    expect(await own.read(initial.id)).toEqual(initial)
  }, 30000)

  test("returns the complete bounded catalog and rejects overflow instead of truncation", async () => {
    const userId = `${actorPrefix}overflow`
    const own = await RemoteTagRepository.open(userId)
    const collection = await getCollection<ReturnType<typeof document>>(
      COLLECTION_NAMES.tags
    )
    const records = Array.from({ length: maximumRemoteTags }, (_, index) =>
      document(category(userId, `Category ${index}`))
    )
    try {
      await collection.insertMany(records)
      const catalog = await own.catalog()
      expect(catalog).toHaveLength(maximumRemoteTags)
      expect(new Set(catalog.map((tag) => tag.id)).size).toBe(maximumRemoteTags)
      await collection.insertOne(
        document(category(userId, "Overflow category"))
      )
      await expect(own.catalog()).rejects.toThrow()
      expect(await collection.countDocuments({ userId })).toBe(
        maximumRemoteTags + 1
      )
    } finally {
      await collection.deleteMany({ userId })
    }
  }, 60000)

  test("uses the supplied session and rolls back multiple writes after a late abort", async () => {
    const database = await assertOwnedDatabase()
    const existing = category(`${actorPrefix}rollback`, "Existing")
    const first = category(existing.userId, "First")
    const second = category(existing.userId, "Second")
    const own = await RemoteTagRepository.open(existing.userId)
    expect(await own.insert(existing)).toBe(true)
    await expect(
      database.client.withSession(async (session) =>
        session.withTransaction(async () => {
          const transaction = await RemoteTagRepository.open(
            existing.userId,
            session
          )
          expect(await transaction.insert(first)).toBe(true)
          expect(await transaction.insert(second)).toBe(true)
          expect(
            await transaction.replace(1, {
              ...existing,
              color: "#abcdef",
              revision: 2,
              updatedAt: later,
            })
          ).toBe(true)
          expect(await transaction.catalog()).toHaveLength(3)
          expect((await transaction.read(existing.id))?.revision).toBe(2)
          expect(await own.read(first.id)).toBeNull()
          expect(await own.read(existing.id)).toEqual(existing)
          throw new Error("Intentional category transaction abort")
        })
      )
    ).rejects.toThrow("Intentional category transaction abort")
    expect(await own.catalog()).toEqual([existing])
    expect(await own.read(first.id)).toBeNull()
    expect(await own.read(second.id)).toBeNull()
    await expect(
      database.client.withSession(async (session) =>
        session.withTransaction(async () => {
          const transaction = await RemoteTagRepository.open(
            existing.userId,
            session
          )
          await transaction.insert(first)
          await transaction.insert(existing)
        })
      )
    ).rejects.toThrow()
    expect(await own.read(first.id)).toBeNull()
    expect(await own.read(existing.id)).toEqual(existing)
  }, 30000)
})
