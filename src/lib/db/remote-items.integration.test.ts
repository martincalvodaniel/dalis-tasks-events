import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import type { CalendarItem } from "@/types/calendar-item"

const config = getSyncDatabaseTestConfig()
const timestamp = "2026-10-08T00:00:00.000Z"
const firstId = "00000000-0000-4000-8000-000000000010"
const secondId = "00000000-0000-4000-8000-000000000020"
const thirdId = "00000000-0000-4000-8000-000000000030"
function task(id: string, ownerId = "owner-a"): CalendarItem {
  return {
    id,
    ownerId,
    kind: "task",
    title: "Test task",
    description: "",
    scheduledDate: "2026-10-08",
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

describe.skipIf(!config)("owned remote items", () => {
  beforeAll(async () => {
    if (!config) throw new Error("Sync test configuration is required")
    expect((await getDatabase()).databaseName).toBe(config.mongodbDatabase)
  }, 30000)
  afterAll(closeDatabaseConnection)

  test("isolates owners and prevents duplicate identity overwrites", async () => {
    const own = await RemoteItemRepository.open("owner-a")
    const other = await RemoteItemRepository.open("owner-b")
    expect(await own.insert(task(firstId))).toBe(true)
    expect(await own.insert({ ...task(firstId), title: "Duplicate" })).toBe(
      false
    )
    expect(await other.insert(task(firstId, "owner-b"))).toBe(false)
    expect(await other.read(firstId)).toBeNull()
    expect(
      await other.replace(1, { ...task(firstId, "owner-b"), revision: 2 })
    ).toBe(false)
    expect((await own.read(firstId))?.title).toBe("Test task")
    await expect(own.insert(task(secondId, "owner-b"))).rejects.toThrow()
  }, 30000)

  test("lets exactly one editor advance a revision and preserves tombstones", async () => {
    const own = await RemoteItemRepository.open("owner-a")
    const next = {
      ...task(firstId),
      revision: 2,
      updatedAt: "2026-10-08T00:00:01.000Z",
    }
    const results = await Promise.all([
      own.replace(1, { ...next, title: "First editor" }),
      own.replace(1, { ...next, title: "Second editor" }),
    ])
    expect(results.toSorted()).toEqual([false, true])
    expect((await own.read(firstId))?.revision).toBe(2)
    const stored = await own.read(firstId)
    if (!stored) throw new Error("Expected stored item")
    expect(
      await own.replace(2, {
        ...stored,
        revision: 3,
        deletedAt: "2026-10-08T00:00:02.000Z",
        updatedAt: "2026-10-08T00:00:02.000Z",
      })
    ).toBe(true)
    const deleted = await own.read(firstId)
    expect(deleted?.deletedAt).toBe("2026-10-08T00:00:02.000Z")
    expect(await own.replace(3, { ...stored, revision: 4 })).toBe(false)
    expect(await own.insert(task(firstId))).toBe(false)
  }, 30000)

  test("pages by stable identity, including deleted records without another owner", async () => {
    const own = await RemoteItemRepository.open("owner-a")
    const other = await RemoteItemRepository.open("owner-b")
    expect(await own.insert(task(secondId))).toBe(true)
    expect(await other.insert(task(thirdId, "owner-b"))).toBe(true)
    const first = await own.page({ limit: 1 })
    expect(first.items.map((item) => item.id)).toEqual([firstId])
    expect(first.items[0].deletedAt).not.toBeNull()
    expect(first.nextAfter).toBe(firstId)
    const second = await own.page({ limit: 1, afterId: first.nextAfter })
    expect(second.items.map((item) => item.id)).toEqual([secondId])
    expect(second.nextAfter).toBeNull()
    expect((await own.page({ afterId: secondId })).items).toEqual([])
    await expect(own.page({ limit: 101 })).rejects.toThrow()
    await expect(own.page({ afterId: "invalid" })).rejects.toThrow()
    await expect(
      own.replace(1, { ...task(secondId), revision: 3 })
    ).rejects.toThrow()
    expect(
      await own.replace(1, {
        ...task(secondId),
        revision: 2,
        createdAt: "2026-10-08T00:00:01.000Z",
      })
    ).toBe(false)
  }, 30000)

  test("rejects invalid stored records without returning a partial page", async () => {
    const own = await RemoteItemRepository.open("owner-a")
    const collection = await getCollection<{ _id: string; title: unknown }>(
      COLLECTION_NAMES.items
    )
    await collection.updateOne({ _id: secondId }, { $set: { title: 123 } })
    try {
      await expect(own.read(secondId)).rejects.toThrow()
      await expect(own.page()).rejects.toThrow()
    } finally {
      await collection.updateOne(
        { _id: secondId },
        { $set: { title: "Test task" } }
      )
    }
  }, 30000)
})
