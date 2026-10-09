import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import {
  COLLECTION_NAMES,
  type CollectionName,
  getCollection,
} from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { RemoteItemViewRepository } from "@/lib/db/remote-item-views"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { RemoteTaskPlacementRepository } from "@/lib/db/remote-task-placements"
import { overduePlacementDate } from "@/schemas/ordering"
import { maximumRemoteTaskCatalog } from "@/schemas/remote-task-placement-planning"
import type { CalendarItem } from "@/types/calendar-item"
import type { ItemView, TaskPlacement } from "@/types/preferences"

const config = getSyncDatabaseTestConfig()
const actorPrefix = `remote-placements-${config?.runId}-`
const timestamp = "2026-10-09T00:00:00.000Z"
const later = "2026-10-09T00:00:01.000Z"
const firstId = "00000000-0000-4000-8000-000000000001"
const secondId = "00000000-0000-4000-8000-000000000002"

function placement(
  userId: string,
  occurrenceId = crypto.randomUUID()
): TaskPlacement {
  return {
    userId,
    occurrenceId,
    scope: "day",
    date: "2026-10-09",
    tagId: null,
    position: 0,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
}
function key(value: TaskPlacement) {
  return {
    occurrenceId: value.occurrenceId,
    scope: value.scope,
    date: value.date,
  }
}
function storedPlacement(value: TaskPlacement) {
  return {
    ...value,
    _id: JSON.stringify([
      value.userId,
      value.scope,
      value.date,
      value.occurrenceId,
    ]),
  }
}
function view(userId: string, itemId: string): ItemView {
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
function task(ownerId: string, id: string): CalendarItem {
  return {
    id,
    ownerId,
    kind: "task",
    title: "Placement catalog task",
    description: "",
    scheduledDate: "2026-10-09",
    status: "not_started",
    checklist: [],
    recurrence: null,
    completedAt: null,
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
    throw new Error("Placement test database does not match its owned run")
  return database
}
async function rawCollection(name: CollectionName) {
  return getCollection<{ _id: string; [key: string]: unknown }>(name)
}

describe.skipIf(!config)(
  "owned remote task placements and movement catalogs",
  () => {
    beforeAll(async () => {
      const database = await assertOwnedDatabase()
      const staged = INDEX_SPECS.filter(
        (spec) =>
          spec.collection === COLLECTION_NAMES.taskPlacements ||
          spec.collection === COLLECTION_NAMES.itemViews
      )
      expect(staged).toHaveLength(2)
      expect(staged.every((spec) => spec.provisioning === "explicit")).toBe(
        true
      )
      await ensureIndexes(database, staged)
    }, 30000)

    afterAll(async () => {
      try {
        await assertOwnedDatabase()
        for (const name of [
          COLLECTION_NAMES.taskPlacements,
          COLLECTION_NAMES.itemViews,
        ])
          await (await getCollection(name)).deleteMany({
            userId: { $regex: `^${actorPrefix}` },
          })
        await (await getCollection(COLLECTION_NAMES.items)).deleteMany({
          ownerId: { $regex: `^${actorPrefix}` },
        })
      } finally {
        await closeDatabaseConnection()
      }
    }, 30000)

    test("isolates actors, scopes and dates and rejects invalid identity and metadata", async () => {
      const initial = placement(`${actorPrefix}isolation`, firstId)
      const own = await RemoteTaskPlacementRepository.open(initial.userId)
      const other = await RemoteTaskPlacementRepository.open(
        `${actorPrefix}other`
      )
      expect(await own.insert(initial)).toBe(true)
      expect(await other.read(key(initial))).toBeNull()
      const foreign = { ...initial, userId: `${actorPrefix}other` }
      expect(await other.insert(foreign)).toBe(true)
      const nextDay = { ...initial, date: "2026-10-10" }
      const overdue: TaskPlacement = {
        ...initial,
        scope: "overdue",
        date: overduePlacementDate,
      }
      const occurrence = { ...initial, occurrenceId: `${firstId}:2026-10-09` }
      for (const value of [nextDay, overdue, occurrence]) {
        expect(await own.read(key(value))).toBeNull()
        expect(await own.insert(value)).toBe(true)
        expect(await own.read(key(value))).toEqual(value)
      }
      expect(await own.read(key(initial))).toEqual(initial)
      expect(await other.read(key(initial))).toEqual(foreign)
      expect(await own.insert({ ...initial, position: 999 })).toBe(false)
      await expect(own.insert(foreign)).rejects.toThrow()
      await expect(
        own.replace(1, { ...foreign, revision: 2 })
      ).rejects.toThrow()
      await expect(RemoteTaskPlacementRepository.open("")).rejects.toThrow()
      for (const invalid of [
        { ...key(initial), occurrenceId: "invalid" },
        { ...key(initial), occurrenceId: `${firstId}:2026-02-30` },
        { ...key(initial), date: "2026-02-30" },
        { ...key(initial), scope: "overdue" },
        { ...key(initial), extra: true },
      ])
        await expect(own.read(invalid)).rejects.toThrow()
      for (const invalid of [
        { revision: 0 },
        { revision: 2 },
        { deletedAt: timestamp },
        { updatedAt: later },
        { tagId: "invalid" },
        { position: Infinity },
        { scope: "overdue" },
        { occurrenceId: "invalid" },
        { extra: true },
      ])
        await expect(
          own.insert({ ...placement(initial.userId), ...invalid })
        ).rejects.toThrow()
      await expect(own.replace(0, initial)).rejects.toThrow()
      await expect(
        own.replace(1, { ...initial, revision: 3 })
      ).rejects.toThrow()
      expect(
        await own.replace(1, {
          ...initial,
          revision: 2,
          createdAt: later,
          updatedAt: later,
        })
      ).toBe(false)
      expect(
        await own.replace(1, { ...initial, revision: 2, date: "2026-10-11" })
      ).toBe(false)
      expect(await own.read(key(initial))).toEqual(initial)
      expect((await own.catalog()).map(key)).toEqual([
        key(initial),
        key(occurrence),
        key(nextDay),
        key(overdue),
      ])
    }, 30000)

    test("advances one CAS winner and keeps tombstones without resurrection", async () => {
      const initial = placement(`${actorPrefix}cas`)
      const own = await RemoteTaskPlacementRepository.open(initial.userId)
      expect(await own.insert(initial)).toBe(true)
      const next = { ...initial, revision: 2, updatedAt: later }
      expect(
        (
          await Promise.all([
            own.replace(1, {
              ...next,
              position: 10,
              tagId: crypto.randomUUID(),
            }),
            own.replace(1, {
              ...next,
              position: 20,
              tagId: crypto.randomUUID(),
            }),
          ])
        ).toSorted()
      ).toEqual([false, true])
      const winner = await own.read(key(initial))
      if (!winner) throw new Error("Expected task placement CAS winner")
      expect(winner.revision).toBe(2)
      expect(winner.tagId).not.toBeNull()
      const tombstone = {
        ...winner,
        revision: 3,
        tagId: null,
        deletedAt: later,
      }
      expect(await own.replace(2, tombstone)).toBe(true)
      expect(await own.read(key(initial))).toEqual(tombstone)
      expect(await own.catalog()).toEqual([tombstone])
      expect(await own.replace(3, { ...winner, revision: 4 })).toBe(false)
      expect(await own.insert(initial)).toBe(false)
      expect(await own.read(key(initial))).toEqual(tombstone)
    }, 30000)

    test("rejects stored corruption across point reads and complete placement catalogs", async () => {
      const initial = placement(`${actorPrefix}corrupt`)
      const own = await RemoteTaskPlacementRepository.open(initial.userId)
      expect(await own.insert(initial)).toBe(true)
      const collection = await rawCollection(COLLECTION_NAMES.taskPlacements)
      const stored = storedPlacement(initial)
      for (const corruption of [
        { revision: 0 },
        { tagId: "invalid" },
        { scope: "overdue" },
        { occurrenceId: secondId },
        { date: "2026-10-10" },
        { extra: true },
      ]) {
        await collection.updateOne({ _id: stored._id }, { $set: corruption })
        try {
          await expect(
            own.read(key({ ...initial, ...corruption } as TaskPlacement))
          ).rejects.toThrow()
          await expect(own.catalog()).rejects.toThrow()
        } finally {
          await collection.replaceOne({ _id: stored._id }, stored)
        }
      }
      expect(await own.catalog()).toEqual([initial])
    }, 30000)

    test("sorts own item and view catalogs, includes tombstones and rejects corrupt records", async () => {
      const actor = `${actorPrefix}catalog`
      const otherActor = `${actorPrefix}catalog-other`
      const items = await RemoteItemRepository.open(actor)
      const views = await RemoteItemViewRepository.open(actor)
      const first = task(actor, crypto.randomUUID())
      const second = task(actor, crypto.randomUUID())
      for (const item of [second, first]) {
        expect(await items.insert(item)).toBe(true)
        expect(await views.insert(view(actor, item.id))).toBe(true)
      }
      const foreignItem = task(otherActor, crypto.randomUUID())
      expect(
        await (await RemoteItemRepository.open(otherActor)).insert(foreignItem)
      ).toBe(true)
      expect(
        await (await RemoteItemViewRepository.open(otherActor)).insert(
          view(otherActor, first.id)
        )
      ).toBe(true)
      const deletedItem = {
        ...first,
        revision: 2,
        updatedAt: later,
        deletedAt: later,
      }
      const deletedView = {
        ...view(actor, first.id),
        revision: 2,
        updatedAt: later,
        deletedAt: later,
      }
      expect(await items.replace(1, deletedItem)).toBe(true)
      expect(await views.replace(1, deletedView)).toBe(true)
      const expectedIds = [first.id, second.id].toSorted()
      expect((await items.catalog()).map((item) => item.id)).toEqual(
        expectedIds
      )
      expect((await views.catalog()).map((item) => item.itemId)).toEqual(
        expectedIds
      )
      expect(
        (await items.catalog()).find((item) => item.id === first.id)
      ).toEqual(deletedItem)
      expect(
        (await views.catalog()).find((item) => item.itemId === first.id)
      ).toEqual(deletedView)
      for (const [name, stored, repository] of [
        [COLLECTION_NAMES.items, { ...deletedItem, _id: first.id }, items],
        [
          COLLECTION_NAMES.itemViews,
          { ...deletedView, _id: JSON.stringify([actor, first.id]) },
          views,
        ],
      ] as const) {
        const collection = await rawCollection(name)
        for (const corruption of [
          { revision: 0 },
          name === COLLECTION_NAMES.items
            ? { id: crypto.randomUUID() }
            : { itemId: crypto.randomUUID() },
          { extra: true },
        ]) {
          await collection.updateOne({ _id: stored._id }, { $set: corruption })
          try {
            await expect(repository.catalog()).rejects.toThrow()
          } finally {
            await collection.replaceOne({ _id: stored._id }, stored)
          }
        }
      }
    }, 30000)

    test("shares one transaction snapshot across all movement catalogs and rolls back late failures", async () => {
      const database = await assertOwnedDatabase()
      const actor = `${actorPrefix}rollback`
      const initial = placement(actor)
      const fresh = placement(actor)
      const own = await RemoteTaskPlacementRepository.open(actor)
      const items = await RemoteItemRepository.open(actor)
      const views = await RemoteItemViewRepository.open(actor)
      const freshItem = task(actor, crypto.randomUUID())
      const freshView = view(actor, freshItem.id)
      expect(await own.insert(initial)).toBe(true)
      await expect(
        database.client.withSession((session) =>
          session.withTransaction(async () => {
            const transaction = await RemoteTaskPlacementRepository.open(
              actor,
              session
            )
            const transactionItems = await RemoteItemRepository.open(
              actor,
              session
            )
            const transactionViews = await RemoteItemViewRepository.open(
              actor,
              session
            )
            expect(await transaction.insert(fresh)).toBe(true)
            expect(
              await transaction.replace(1, {
                ...initial,
                revision: 2,
                position: 3,
                updatedAt: later,
              })
            ).toBe(true)
            expect(await transactionItems.insert(freshItem)).toBe(true)
            expect(await transactionViews.insert(freshView)).toBe(true)
            expect(await transaction.read(key(fresh))).toEqual(fresh)
            expect(
              (await transaction.catalog()).find(
                (value) => value.occurrenceId === initial.occurrenceId
              )?.revision
            ).toBe(2)
            expect(await transactionItems.catalog()).toEqual([freshItem])
            expect(await transactionViews.catalog()).toEqual([freshView])
            expect(await own.read(key(fresh))).toBeNull()
            expect(await own.catalog()).toEqual([initial])
            expect(await items.catalog()).toEqual([])
            expect(await views.catalog()).toEqual([])
            throw new Error("Intentional movement catalog transaction abort")
          })
        )
      ).rejects.toThrow("Intentional movement catalog transaction abort")
      expect(await own.catalog()).toEqual([initial])
      expect(await items.catalog()).toEqual([])
      expect(await views.catalog()).toEqual([])
      await expect(
        database.client.withSession((session) =>
          session.withTransaction(async () => {
            const transaction = await RemoteTaskPlacementRepository.open(
              actor,
              session
            )
            await (await RemoteItemRepository.open(actor, session)).insert(
              freshItem
            )
            await (await RemoteItemViewRepository.open(actor, session)).insert(
              freshView
            )
            await transaction.insert(fresh)
            await transaction.insert(initial)
          })
        )
      ).rejects.toThrow()
      expect(await own.catalog()).toEqual([initial])
      expect(await items.catalog()).toEqual([])
      expect(await views.catalog()).toEqual([])
    }, 30000)

    test("accepts complete catalogs at the bound and rejects all three oversized catalogs", async () => {
      const actor = `${actorPrefix}bound`
      const ids = Array.from({ length: maximumRemoteTaskCatalog + 1 }, () =>
        crypto.randomUUID()
      ).toSorted()
      const placements = await RemoteTaskPlacementRepository.open(actor)
      const items = await RemoteItemRepository.open(actor)
      const views = await RemoteItemViewRepository.open(actor)
      for (const [name, documents, repository] of [
        [
          COLLECTION_NAMES.taskPlacements,
          ids.map((id) => storedPlacement(placement(actor, id))),
          placements,
        ],
        [
          COLLECTION_NAMES.items,
          ids.map((id) => ({ ...task(actor, id), _id: id })),
          items,
        ],
        [
          COLLECTION_NAMES.itemViews,
          ids.map((id) => ({
            ...view(actor, id),
            _id: JSON.stringify([actor, id]),
          })),
          views,
        ],
      ] as const) {
        const collection = await rawCollection(name)
        await collection.insertMany([...documents])
        await expect(repository.catalog()).rejects.toThrow(
          "exceeds the supported limit"
        )
        expect(
          (await collection.deleteOne({ _id: documents.at(-1)?._id }))
            .deletedCount
        ).toBe(1)
        const catalog = await repository.catalog()
        expect(catalog).toHaveLength(maximumRemoteTaskCatalog)
        const identities = catalog.map((value) =>
          "occurrenceId" in value
            ? value.occurrenceId
            : "itemId" in value
              ? value.itemId
              : value.id
        )
        expect(identities).toEqual(ids.slice(0, -1))
      }
    }, 60000)
  }
)
