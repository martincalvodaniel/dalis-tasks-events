import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import type { Document } from "mongodb"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { RemoteCursorAheadError } from "@/lib/db/remote-changes"
import { readRemoteChangesV2 } from "@/lib/db/remote-changes-v2"
import { executeRemoteItemOperation } from "@/lib/db/remote-item-commands"
import { executeRemoteItemViewOperation } from "@/lib/db/remote-item-view-commands"
import { executeRemoteTagOperation } from "@/lib/db/remote-tag-commands"
import { RemoteTagRepository } from "@/lib/db/remote-tags"
import { maximumRemoteChangesPageBytes } from "@/schemas/remote-changes-page-v2"
import type { CalendarItem } from "@/types/calendar-item"
import type { SyncCommand } from "@/types/sync"

const config = getSyncDatabaseTestConfig()
const prefix = `mixed-reader-${config?.runId}-`
const timestamp = "2026-10-08T00:00:00.000Z"
const metadata = {
  revision: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
}
function operation(command: SyncCommand, baseRevision = 0) {
  return {
    operationId: crypto.randomUUID(),
    protocolVersion: 1,
    baseRevision,
    command,
  }
}
async function seed(actor: string) {
  const first = await executeRemoteItemOperation(
    actor,
    operation({
      type: "item.create",
      itemId: crypto.randomUUID(),
      input: {
        kind: "task",
        title: "Owned task",
        description: "",
        scheduledDate: "2026-10-08",
        status: "not_started",
        checklist: [],
        recurrence: null,
      },
    })
  )
  if (first.status !== "applied")
    throw new Error("Expected committed mixed item")
  const category = await executeRemoteTagOperation(
    actor,
    operation({
      type: "tag.save",
      tagId: crypto.randomUUID(),
      input: { name: "Own", color: "#123456", position: 1024 },
    })
  )
  if (category.kind !== "preference" || category.outcome.status !== "applied")
    throw new Error("Expected committed mixed category")
  const effect = category.outcome.effects.effects[0]
  if (effect.store !== "tags") throw new Error("Expected category effect")
  return { item: first.item, tag: effect.record }
}
async function ownedDatabase() {
  if (!config) throw new Error("Sync test configuration is required")
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Mixed reader database does not match its owned run")
  return database
}

describe.skipIf(!config)("checkpointed mixed change download", () => {
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

  test("freezes the mixed checkpoint, preserves legacy history and reads later tombstones incrementally", async () => {
    const actor = `${prefix}history`
    const { item, tag } = await seed(actor)
    await executeRemoteItemViewOperation(
      actor,
      operation({
        type: "item-view.set",
        itemId: item.id,
        primaryTagId: tag.id,
      })
    )
    const journal = await getCollection<Document & { _id: string }>(
      COLLECTION_NAMES.syncChanges
    )
    const original = await journal.findOne({
      recipientUserId: actor,
      sequence: 1,
    })
    const first = await readRemoteChangesV2(actor, { limit: 1 })
    expect(first.through).toBe(3)
    expect(first.changes[0].kind).toBe("item")
    expect(first.nextAfter).toBe(1)
    expect(first.hasMore).toBe(true)
    await executeRemoteTagOperation(
      actor,
      operation({ type: "tag.delete", tagId: tag.id }, 1)
    )
    await executeRemoteItemOperation(
      actor,
      operation({ type: "item.delete", itemId: item.id }, 1)
    )
    const continuation = await readRemoteChangesV2(actor, {
      after: first.nextAfter,
      through: first.through,
    })
    expect(continuation.changes.map((change) => change.kind)).toEqual([
      "preference",
      "preference",
    ])
    expect(continuation.changes.map((change) => change.sequence)).toEqual([
      2, 3,
    ])
    expect(continuation.nextAfter).toBe(3)
    expect(continuation.hasMore).toBe(false)
    const later = await readRemoteChangesV2(actor, {
      after: continuation.nextAfter,
    })
    expect(later.changes.map((change) => change.sequence)).toEqual([4, 5])
    const deletedCategory = later.changes[0]
    if (deletedCategory.kind !== "preference")
      throw new Error("Expected personal change")
    expect(deletedCategory.effects.effects[0].record.deletedAt).not.toBeNull()
    const deletedItem = later.changes[1]
    if (deletedItem.kind !== "item") throw new Error("Expected item change")
    expect(deletedItem.item.deletedAt).not.toBeNull()
    expect(await readRemoteChangesV2(actor, { after: 5, through: 5 })).toEqual({
      version: 2,
      changes: [],
      nextAfter: 5,
      through: 5,
      hasMore: false,
    })
    expect(
      await journal.findOne({ recipientUserId: actor, sequence: 1 })
    ).toEqual(original)
    first.changes[0].recipientUserId = "changed-clone"
    expect(
      (await readRemoteChangesV2(actor, { limit: 1 })).changes[0]
        .recipientUserId
    ).toBe(actor)
  }, 30000)

  test("isolates accounts and rejects future cursors or injected query fields before returning a page", async () => {
    const actor = `${prefix}isolation`
    await seed(actor)
    const other = `${prefix}empty`
    expect(await readRemoteChangesV2(other, {})).toEqual({
      version: 2,
      changes: [],
      nextAfter: 0,
      through: 0,
      hasMore: false,
    })
    await expect(
      readRemoteChangesV2(other, { after: 1 })
    ).rejects.toBeInstanceOf(RemoteCursorAheadError)
    await expect(
      readRemoteChangesV2(actor, { through: 3 })
    ).rejects.toBeInstanceOf(RemoteCursorAheadError)
    await expect(readRemoteChangesV2(actor, { limit: 101 })).rejects.toThrow()
    await expect(
      readRemoteChangesV2(actor, { recipientUserId: other })
    ).rejects.toThrow()
    await expect(readRemoteChangesV2("", {})).rejects.toThrow()
  }, 30000)

  test("rejects holes, corrupt or unsupported history and unavailable current authorization without a partial page", async () => {
    const actor = `${prefix}corrupt`
    const { item, tag } = await seed(actor)
    await executeRemoteItemViewOperation(
      actor,
      operation({
        type: "item-view.set",
        itemId: item.id,
        primaryTagId: tag.id,
      })
    )
    const journal = await getCollection<Document & { _id: string }>(
      COLLECTION_NAMES.syncChanges
    )
    const document = await journal.findOne({
      recipientUserId: actor,
      sequence: 2,
    })
    if (!document) throw new Error("Expected category journal")
    await journal.deleteOne({ _id: document._id })
    try {
      await expect(readRemoteChangesV2(actor, {})).rejects.toThrow(
        "missing sequence"
      )
    } finally {
      await journal.insertOne(document)
    }
    for (const corrupt of [
      { version: 3 },
      { "effects.effects.0.record.revision": 0 },
    ]) {
      await journal.updateOne({ _id: document._id }, { $set: corrupt })
      try {
        await expect(readRemoteChangesV2(actor, {})).rejects.toThrow()
      } finally {
        const { _id, ...value } = document
        await journal.replaceOne({ _id }, value)
      }
    }
    const unsupported = {
      ...document,
      effects: {
        version: 1,
        userId: actor,
        operationId: document.operationId,
        sequence: 2,
        effects: [
          {
            store: "settings",
            record: {
              ...metadata,
              userId: actor,
              timeZone: "Europe/Madrid",
              locale: "es-ES",
              weekStartsOn: 1,
            },
          },
        ],
      },
    }
    const { _id, ...value } = unsupported
    await journal.replaceOne({ _id }, value)
    try {
      await expect(readRemoteChangesV2(actor, {})).rejects.toThrow(
        "not supported"
      )
    } finally {
      const { _id, ...original } = document
      await journal.replaceOne({ _id }, original)
    }
    const items = await getCollection<{ _id: string; ownerId: string }>(
      COLLECTION_NAMES.items
    )
    await items.updateOne(
      { _id: item.id },
      { $set: { ownerId: `${prefix}foreign` } }
    )
    try {
      await expect(readRemoteChangesV2(actor, {})).rejects.toThrow(
        "access is unavailable"
      )
    } finally {
      await items.updateOne({ _id: item.id }, { $set: { ownerId: actor } })
    }
    const views = await getCollection<Document & { _id: string }>(
      COLLECTION_NAMES.itemViews
    )
    const view = await views.findOne({ userId: actor, itemId: item.id })
    if (!view) throw new Error("Expected own view fixture")
    await views.deleteOne({ _id: view._id })
    try {
      await expect(readRemoteChangesV2(actor, { after: 2 })).rejects.toThrow(
        "view access is unavailable"
      )
    } finally {
      await views.insertOne(view)
    }
    expect(
      (await (await RemoteTagRepository.open(actor)).read(tag.id))?.revision
    ).toBe(1)
    expect((await readRemoteChangesV2(actor, {})).changes).toHaveLength(3)
  }, 30000)

  test("pages by complete UTF8 records and continues without losing any committed sequence", async () => {
    const actor = `${prefix}bytes`
    const checklist = Array.from({ length: 100 }, () => ({
      id: crypto.randomUUID(),
      text: "ñ".repeat(500),
      completed: false,
    }))
    const items: CalendarItem[] = Array.from({ length: 28 }, () => ({
      ...metadata,
      id: crypto.randomUUID(),
      ownerId: actor,
      kind: "task",
      title: "Large own task",
      description: "",
      scheduledDate: "2026-10-08",
      status: "not_started",
      checklist,
      completedAt: null,
      recurrence: null,
    }))
    const database = await ownedDatabase()
    await database.client.withSession((session) =>
      session.withTransaction(async () => {
        await (
          await getCollection<CalendarItem & { _id: string }>(
            COLLECTION_NAMES.items
          )
        ).insertMany(
          items.map((item) => ({ ...item, _id: item.id })),
          { session }
        )
        await (
          await getCollection<Document & { _id: string }>(
            COLLECTION_NAMES.syncChanges
          )
        ).insertMany(
          items.map((item, index) => ({
            _id: crypto.randomUUID(),
            recipientUserId: actor,
            operationId: crypto.randomUUID(),
            sequence: index + 1,
            item,
          })),
          { session }
        )
        await (
          await getCollection<{ _id: string; sequence: number }>(
            COLLECTION_NAMES.syncCounters
          )
        ).insertOne({ _id: actor, sequence: items.length }, { session })
      })
    )
    const first = await readRemoteChangesV2(actor, { limit: 100 })
    expect(first.changes.length).toBeGreaterThan(0)
    expect(first.changes.length).toBeLessThan(items.length)
    expect(first.hasMore).toBe(true)
    expect(
      new TextEncoder().encode(JSON.stringify(first)).byteLength
    ).toBeLessThanOrEqual(maximumRemoteChangesPageBytes)
    const last = await readRemoteChangesV2(actor, {
      after: first.nextAfter,
      through: first.through,
      limit: 100,
    })
    expect(last.hasMore).toBe(false)
    expect(
      [...first.changes, ...last.changes].map((change) => change.sequence)
    ).toEqual(items.map((_, index) => index + 1))
    expect(last.nextAfter).toBe(items.length)
    for (const change of [...first.changes, ...last.changes]) {
      if (change.kind !== "item" || change.item.kind !== "task")
        throw new Error("Expected complete task change")
      expect(change.item.checklist).toHaveLength(100)
    }
  }, 30000)
})
