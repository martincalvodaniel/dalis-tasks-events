import "server-only"

import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { executeRemoteItemOperation } from "@/lib/db/remote-item-commands"
import { executeRemoteItemViewOperation } from "@/lib/db/remote-item-view-commands"
import { RemoteItemViewRepository } from "@/lib/db/remote-item-views"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { readRemoteOperationReceipt } from "@/lib/db/remote-operation-receipts"
import { executeRemoteTagOperation } from "@/lib/db/remote-tag-commands"
import { RemoteTagRepository } from "@/lib/db/remote-tags"
import type { SyncCommand, SyncOperation } from "@/types/sync"

const config = getSyncDatabaseTestConfig()
const prefix = `preference-race-${config?.runId}-`
function operation(command: SyncCommand, baseRevision = 0): SyncOperation {
  return {
    operationId: crypto.randomUUID(),
    protocolVersion: 1,
    baseRevision,
    command,
  }
}
function createTag(name: string, position = 1024) {
  return operation({
    type: "tag.save",
    tagId: crypto.randomUUID(),
    input: { name, color: "#123456", position },
  })
}
function barrier() {
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  return {
    entered: entered.promise,
    signal: () => entered.resolve(),
    released: release.promise,
    release: () => release.resolve(),
  }
}
async function reached(
  gate: ReturnType<typeof barrier>,
  pending: Promise<unknown>
) {
  await Promise.race([
    gate.entered,
    pending.then(() => {
      throw new Error("Operation completed before its controlled snapshot")
    }),
  ])
}
async function ownedDatabase() {
  if (!config) throw new Error("Sync test configuration is required")
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Preference race database does not match its owned run")
  return database
}
async function history(actor: string) {
  return {
    receipts: await (
      await getCollection(COLLECTION_NAMES.syncOperations)
    ).countDocuments({ actorUserId: actor }),
    changes: await (await getCollection(COLLECTION_NAMES.syncChanges))
      .find({ recipientUserId: actor })
      .sort({ sequence: 1 })
      .toArray(),
    counter: await (
      await getCollection<{ _id: string; sequence: number }>(
        COLLECTION_NAMES.syncCounters
      )
    ).findOne({ _id: actor }),
  }
}
async function seedItem(actor: string) {
  const command = operation({
    type: "item.create",
    itemId: crypto.randomUUID(),
    input: {
      kind: "task",
      title: "Own race task",
      description: "",
      scheduledDate: "2026-10-08",
      status: "not_started",
      checklist: [],
      recurrence: null,
    },
  })
  const result = await executeRemoteItemOperation(actor, command)
  if (result.status !== "applied")
    throw new Error("Expected committed race item")
  return result.item
}

describe.skipIf(!config)("overlapping preference snapshots", () => {
  beforeAll(async () => {
    const database = await ownedDatabase()
    await ensureIndexes(
      database,
      INDEX_SPECS.filter(
        (spec) =>
          spec.collection === COLLECTION_NAMES.tags ||
          spec.collection === COLLECTION_NAMES.itemViews
      )
    )
  }, 30000)
  afterAll(async () => {
    try {
      await ownedDatabase()
      for (const [collection, key] of [
        [COLLECTION_NAMES.items, "ownerId"],
        [COLLECTION_NAMES.tags, "userId"],
        [COLLECTION_NAMES.itemViews, "userId"],
        [COLLECTION_NAMES.syncOperations, "actorUserId"],
        [COLLECTION_NAMES.syncChanges, "recipientUserId"],
        [COLLECTION_NAMES.syncCounters, "_id"],
      ] as const)
        await (await getCollection(collection)).deleteMany({
          [key]: { $regex: `^${prefix}` },
        })
    } finally {
      await closeDatabaseConnection()
    }
  }, 30000)

  test.each(["create", "delete"])(
    "rereads movement neighbors after a concurrent %s commit",
    async (change) => {
      const actor = `${prefix}neighbors-${change}`
      for (let index = 0; index < 3; index++)
        expect(
          (
            await executeRemoteTagOperation(
              actor,
              createTag(`Category ${index}`, (index + 1) * 1024)
            )
          ).outcome.status
        ).toBe("applied")
      const repository = await RemoteTagRepository.open(actor)
      const tags = (await repository.catalog()).toSorted(
        (a, b) => a.position - b.position
      )
      const move = operation(
        {
          type: "tag.move",
          tagId: tags[2].id,
          beforeId: tags[1].id,
          afterId: tags[0].id,
        },
        1
      )
      const gate = barrier()
      const original = RemoteTagRepository.prototype.catalog
      let snapshots = 0
      let held = false
      const mock = spyOn(
        RemoteTagRepository.prototype,
        "catalog"
      ).mockImplementation(async function (this: RemoteTagRepository) {
        const records = await original.call(this)
        if (records.some((tag) => tag.userId === actor)) {
          snapshots++
          if (!held) {
            held = true
            gate.signal()
            await gate.released
          }
        }
        return records
      })
      const pending = executeRemoteTagOperation(actor, move)
      try {
        await reached(gate, pending)
        const concurrent =
          change === "create"
            ? createTag("Inserted neighbor", 1536)
            : operation({ type: "tag.delete", tagId: tags[0].id }, 1)
        expect(
          (await executeRemoteTagOperation(actor, concurrent)).outcome.status
        ).toBe("applied")
        gate.release()
        expect((await pending).outcome.status).toBe("invalid_command")
        // Initial held read + concurrent catalog + retry must all have occurred.
        expect(snapshots).toBeGreaterThanOrEqual(3)
        expect(await repository.read(tags[2].id)).toEqual(tags[2])
        const state = await history(actor)
        expect(state.counter?.sequence).toBe(4)
        expect(state.changes.map((record) => record.sequence)).toEqual([
          1, 2, 3, 4,
        ])
        expect(
          state.changes.some(
            (record) => record.operationId === move.operationId
          )
        ).toBe(false)
        expect(state.receipts).toBe(5)
        expect(
          (await readRemoteOperationReceipt(actor, move.operationId))?.result
            .outcome.status
        ).toBe("invalid_command")
      } finally {
        gate.release()
        await pending.catch(() => undefined)
        mock.mockRestore()
      }
    },
    30000
  )

  test("rereads item authorization after deletion commits against an active snapshot", async () => {
    const actor = `${prefix}item-delete`
    const item = await seedItem(actor)
    const view = operation({
      type: "item-view.set",
      itemId: item.id,
      primaryTagId: null,
    })
    const gate = barrier()
    const original = RemoteItemRepository.prototype.read
    let held = false
    let sawDeleted = false
    const mock = spyOn(
      RemoteItemRepository.prototype,
      "read"
    ).mockImplementation(async function (
      this: RemoteItemRepository,
      id: unknown
    ) {
      const record = await original.call(this, id)
      if (record?.ownerId === actor) {
        if (record.deletedAt) sawDeleted = true
        if (!held) {
          held = true
          gate.signal()
          await gate.released
        }
      }
      return record
    })
    const pending = executeRemoteItemViewOperation(actor, view)
    try {
      await reached(gate, pending)
      expect(
        (
          await executeRemoteItemOperation(
            actor,
            operation({ type: "item.delete", itemId: item.id }, 1)
          )
        ).status
      ).toBe("applied")
      gate.release()
      expect((await pending).outcome.status).toBe("unavailable")
      expect(sawDeleted).toBe(true)
      expect(
        await (await RemoteItemViewRepository.open(actor)).read(item.id)
      ).toBeNull()
      const state = await history(actor)
      expect(state.counter?.sequence).toBe(2)
      expect(state.changes.map((record) => record.sequence)).toEqual([1, 2])
      expect(state.receipts).toBe(3)
      expect(
        state.changes.some((record) => record.operationId === view.operationId)
      ).toBe(false)
      expect(
        (await readRemoteOperationReceipt(actor, view.operationId))?.result
          .outcome.status
      ).toBe("unavailable")
    } finally {
      gate.release()
      await pending.catch(() => undefined)
      mock.mockRestore()
    }
  }, 30000)

  test("rereads category authorization after deletion commits against an active view snapshot", async () => {
    const actor = `${prefix}tag-delete`
    const item = await seedItem(actor)
    await executeRemoteTagOperation(actor, createTag("Category"))
    const tag = (await (await RemoteTagRepository.open(actor)).catalog())[0]
    const view = operation({
      type: "item-view.set",
      itemId: item.id,
      primaryTagId: tag.id,
    })
    const gate = barrier()
    const original = RemoteTagRepository.prototype.read
    let held = false
    let sawDeleted = false
    const mock = spyOn(
      RemoteTagRepository.prototype,
      "read"
    ).mockImplementation(async function (
      this: RemoteTagRepository,
      id: unknown
    ) {
      const record = await original.call(this, id)
      if (record?.userId === actor) {
        if (record.deletedAt) sawDeleted = true
        if (!held) {
          held = true
          gate.signal()
          await gate.released
        }
      }
      return record
    })
    const pending = executeRemoteItemViewOperation(actor, view)
    try {
      await reached(gate, pending)
      expect(
        (
          await executeRemoteTagOperation(
            actor,
            operation({ type: "tag.delete", tagId: tag.id }, 1)
          )
        ).outcome.status
      ).toBe("applied")
      gate.release()
      expect((await pending).outcome.status).toBe("invalid_command")
      expect(sawDeleted).toBe(true)
      expect(
        await (await RemoteItemViewRepository.open(actor)).read(item.id)
      ).toBeNull()
      const state = await history(actor)
      expect(state.counter?.sequence).toBe(3)
      expect(state.changes.map((record) => record.sequence)).toEqual([1, 2, 3])
      expect(state.receipts).toBe(4)
      expect(
        state.changes.some((record) => record.operationId === view.operationId)
      ).toBe(false)
    } finally {
      gate.release()
      await pending.catch(() => undefined)
      mock.mockRestore()
    }
  }, 30000)

  test("reclassifies a normalized-name collision after aborting the stale insertion", async () => {
    const actor = `${prefix}name`
    await executeRemoteTagOperation(actor, createTag("Seed"))
    const gate = barrier()
    const original = RemoteTagRepository.prototype.catalog
    let held = false
    let snapshots = 0
    const mock = spyOn(
      RemoteTagRepository.prototype,
      "catalog"
    ).mockImplementation(async function (this: RemoteTagRepository) {
      const records = await original.call(this)
      if (records.some((tag) => tag.userId === actor)) {
        snapshots++
        if (!held) {
          held = true
          gate.signal()
          await gate.released
        }
      }
      return records
    })
    const pendingOperation = createTag("ＷＯＲＫ")
    const pending = executeRemoteTagOperation(actor, pendingOperation)
    try {
      await reached(gate, pending)
      expect(
        (await executeRemoteTagOperation(actor, createTag("Work"))).outcome
          .status
      ).toBe("applied")
      gate.release()
      expect((await pending).outcome.status).toBe("invalid_command")
      expect(snapshots).toBeGreaterThanOrEqual(3)
      const tags = await (await RemoteTagRepository.open(actor)).catalog()
      expect(
        tags.filter((tag) => tag.normalizedName === "work" && !tag.deletedAt)
      ).toHaveLength(1)
      const state = await history(actor)
      expect(state.counter?.sequence).toBe(2)
      expect(state.changes).toHaveLength(2)
      expect(state.receipts).toBe(3)
      expect(
        state.changes.some(
          (record) => record.operationId === pendingOperation.operationId
        )
      ).toBe(false)
    } finally {
      gate.release()
      await pending.catch(() => undefined)
      mock.mockRestore()
    }
  }, 30000)
})
