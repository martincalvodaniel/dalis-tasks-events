import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { RemotePlanOccurrenceRepository } from "@/lib/db/remote-plan-occurrences"
import { maximumRemotePlanOccurrenceCatalog } from "@/schemas/remote-plan-occurrence-storage"
import type { PlanOccurrence } from "@/types/plan-occurrence"

const config = getSyncDatabaseTestConfig()
const prefix = `remote-plan-occurrences-${config?.runId}-`
const seriesId = "00000000-0000-4000-8000-000000000001"
const otherSeriesId = "00000000-0000-4000-8000-000000000002"
const now = "2026-10-11T09:00:00.000Z"
const later = "2026-10-11T10:00:00.000Z"

function occurrence(slotKey = "2026-10-11", parent = seriesId): PlanOccurrence {
  return {
    kind: "plan",
    id: `${parent}:${slotKey}`,
    seriesId: parent,
    slotKey,
    content: { title: "Appearance", description: "Independent content" },
    schedule: {
      mode: "all_day",
      startDate: "2026-10-11",
      endDateExclusive: "2026-10-12",
    },
    status: "not_started",
    checklist: [],
    completedAt: null,
    cancelled: false,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}
function key(value: PlanOccurrence) {
  return { seriesId: value.seriesId, id: value.id }
}
function document(actor: string, value: PlanOccurrence) {
  return { ...value, userId: actor, _id: JSON.stringify([actor, value.id]) }
}
async function ownedDatabase() {
  if (!config) throw new Error("Sync test configuration is required")
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Appearance test database does not match its owned run")
  return database
}
async function rawCollection() {
  return getCollection<{ _id: string; [key: string]: unknown }>(
    COLLECTION_NAMES.planOccurrences
  )
}

describe.skipIf(!config)("owned remote plan occurrence persistence", () => {
  beforeAll(async () => {
    const database = await ownedDatabase()
    const indexes = INDEX_SPECS.filter(
      (spec) => spec.collection === COLLECTION_NAMES.planOccurrences
    )
    expect(indexes).toHaveLength(1)
    expect(indexes[0].provisioning).toBe("explicit")
    await ensureIndexes(database, indexes)
  }, 30000)

  afterAll(async () => {
    try {
      await ownedDatabase()
      await (await rawCollection()).deleteMany({
        userId: { $regex: `^${prefix}` },
      })
    } finally {
      await closeDatabaseConnection()
    }
  }, 30000)

  test("isolates accounts and series, validates original slots and preserves independent content", async () => {
    const actor = `${prefix}identity`
    const own = await RemotePlanOccurrenceRepository.open(actor)
    const other = await RemotePlanOccurrenceRepository.open(`${prefix}other`)
    const first = occurrence()
    expect(await own.insert(first)).toBe(true)
    expect(await other.read(key(first))).toBeNull()
    expect(
      await other.insert({
        ...first,
        content: { title: "Other", description: "" },
      })
    ).toBe(true)
    expect((await other.read(key(first)))?.content?.title).toBe("Other")
    expect(await own.read(key(first))).toEqual(first)
    const next = occurrence("2026-10-12")
    const timed = occurrence("2026-10-13T10:30")
    const anotherSeries = occurrence("2026-10-11", otherSeriesId)
    for (const value of [timed, next, anotherSeries]) {
      expect(await own.insert(value)).toBe(true)
      expect(await own.read(key(value))).toEqual(value)
    }
    expect(await own.seriesCatalog(seriesId)).toEqual([first, next, timed])
    expect(await own.seriesCatalog(otherSeriesId)).toEqual([anotherSeries])
    expect(await other.seriesCatalog(otherSeriesId)).toEqual([])
    expect(await own.catalog()).toEqual([first, next, timed, anotherSeries])
    expect(await other.catalog()).toHaveLength(1)
    for (const invalid of [
      { id: "invalid", seriesId },
      { ...key(first), seriesId: otherSeriesId },
      { ...key(first), id: `${seriesId}:2026-02-30` },
      { ...key(first), id: `${seriesId}:2026-10-11T25:00` },
      { ...key(first), extra: true },
    ])
      await expect(own.read(invalid)).rejects.toThrow()
    for (const invalid of [
      { revision: 0 },
      { revision: 2 },
      { updatedAt: later },
      { deletedAt: later },
      { id: "invalid" },
      { userId: `${prefix}other` },
    ])
      await expect(own.insert({ ...first, ...invalid })).rejects.toThrow()
    await expect(RemotePlanOccurrenceRepository.open("")).rejects.toThrow()
    await expect(own.seriesCatalog("invalid")).rejects.toThrow()
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
    expect(await own.insert(first)).toBe(false)
    expect(await own.read(key(first))).toEqual(first)
  }, 30000)

  test("has one CAS winner and never revives cancelled appearances or tombstones", async () => {
    const own = await RemotePlanOccurrenceRepository.open(`${prefix}cas`)
    const first = occurrence()
    expect(
      (await Promise.all([own.insert(first), own.insert(first)])).toSorted()
    ).toEqual([false, true])
    const next = { ...first, revision: 2, updatedAt: later }
    expect(
      (
        await Promise.all([
          own.replace(1, { ...next, status: "in_progress" }),
          own.replace(1, { ...next, status: "completed", completedAt: later }),
        ])
      ).toSorted()
    ).toEqual([false, true])
    const winner = await own.read(key(first))
    if (!winner) throw new Error("Expected appearance CAS winner")
    expect(winner.revision).toBe(2)
    const cancelled = { ...winner, revision: 3, cancelled: true }
    expect(await own.replace(2, cancelled)).toBe(true)
    expect(await own.replace(3, { ...winner, revision: 4 })).toBe(false)
    expect(await own.insert(first)).toBe(false)
    expect(await own.read(key(first))).toEqual(cancelled)
    const second = occurrence("2026-10-12")
    expect(await own.insert(second)).toBe(true)
    const deleted = {
      ...second,
      revision: 2,
      updatedAt: later,
      deletedAt: later,
    }
    expect(await own.replace(1, deleted)).toBe(true)
    expect(await own.replace(2, { ...second, revision: 3 })).toBe(false)
    expect(await own.insert(second)).toBe(false)
    expect(await own.seriesCatalog(seriesId)).toEqual([cancelled, deleted])
    const firstCancelled = { ...occurrence("2026-10-13"), cancelled: true }
    expect(await own.insert(firstCancelled)).toBe(true)
    expect(
      await own.replace(1, { ...firstCancelled, revision: 2, cancelled: false })
    ).toBe(false)
  }, 30000)

  test("commits only with its session and rolls back writes on a later duplicate", async () => {
    const database = await ownedDatabase()
    const actor = `${prefix}transaction`
    const own = await RemotePlanOccurrenceRepository.open(actor)
    const first = occurrence()
    expect(await own.insert(first)).toBe(true)
    const second = occurrence("2026-10-12")
    await expect(
      database.client.withSession(async (session) =>
        session.withTransaction(async () => {
          const tx = await RemotePlanOccurrenceRepository.open(actor, session)
          expect(await tx.insert(second)).toBe(true)
          expect(
            await tx.replace(1, {
              ...first,
              revision: 2,
              updatedAt: later,
              status: "in_progress",
            })
          ).toBe(true)
          expect(await own.read(key(second))).toBeNull()
          expect(await own.read(key(first))).toEqual(first)
          await tx.insert(first)
        })
      )
    ).rejects.toThrow()
    expect(await own.read(key(second))).toBeNull()
    expect(await own.read(key(first))).toEqual(first)
    await database.client.withSession(async (session) =>
      session.withTransaction(async () => {
        const tx = await RemotePlanOccurrenceRepository.open(actor, session)
        expect(await tx.insert(second)).toBe(true)
        expect(
          await tx.replace(1, {
            ...first,
            revision: 2,
            updatedAt: later,
            status: "in_progress",
          })
        ).toBe(true)
      })
    )
    expect(await own.read(key(second))).toEqual(second)
    expect((await own.read(key(first)))?.revision).toBe(2)
  }, 30000)

  test("rejects corrupted metadata and canonical identity in point and catalog reads", async () => {
    const actor = `${prefix}corruption`
    const own = await RemotePlanOccurrenceRepository.open(actor)
    const raw = await rawCollection()
    const first = occurrence()
    const stored = document(actor, first)
    expect(await own.insert(first)).toBe(true)
    for (const change of [
      { revision: 0 },
      { extra: true },
      { id: `${seriesId}:2026-10-12`, slotKey: "2026-10-12" },
    ]) {
      await raw.replaceOne({ _id: stored._id }, { ...stored, ...change })
      try {
        await expect(
          own.read({ ...key(first), ...(change.id ? { id: change.id } : {}) })
        ).rejects.toThrow()
        await expect(own.seriesCatalog(seriesId)).rejects.toThrow()
        await expect(own.catalog()).rejects.toThrow()
      } finally {
        await raw.replaceOne({ _id: stored._id }, stored)
      }
    }
    await raw.insertOne({
      ...stored,
      _id: "noncanonical",
      id: `${seriesId}:2026-10-13`,
      slotKey: "2026-10-13",
    })
    try {
      await expect(
        own.read({ seriesId, id: `${seriesId}:2026-10-13` })
      ).rejects.toThrow()
      await expect(own.seriesCatalog(seriesId)).rejects.toThrow()
      await expect(own.catalog()).rejects.toThrow()
      await expect(
        raw.insertOne({ ...stored, _id: "duplicate-slot" })
      ).rejects.toThrow()
    } finally {
      await raw.deleteOne({ _id: "noncanonical", userId: actor })
    }
    expect(await own.read(key(first))).toEqual(first)
  }, 30000)

  test("rejects an oversized complete series catalog instead of truncating it", async () => {
    const actor = `${prefix}limit`
    const own = await RemotePlanOccurrenceRepository.open(actor)
    const raw = await rawCollection()
    const values = Array.from(
      { length: maximumRemotePlanOccurrenceCatalog + 1 },
      (_, index) => {
        const slot = new Date(Date.UTC(2026, 0, 1 + index))
          .toISOString()
          .slice(0, 10)
        return document(actor, occurrence(slot))
      }
    )
    await raw.insertMany(values)
    await expect(own.seriesCatalog(seriesId)).rejects.toThrow(
      "exceeds the supported limit"
    )
    await expect(own.catalog()).rejects.toThrow("exceeds the supported limit")
    await raw.deleteOne({ _id: values.at(-1)?._id, userId: actor })
    expect(await own.seriesCatalog(seriesId)).toHaveLength(
      maximumRemotePlanOccurrenceCatalog
    )
    expect(await own.catalog()).toHaveLength(maximumRemotePlanOccurrenceCatalog)
  }, 30000)
})
