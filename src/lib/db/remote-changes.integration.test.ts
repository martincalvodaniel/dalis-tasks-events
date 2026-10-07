import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import {
  RemoteCursorAheadError,
  readRemoteChanges,
} from "@/lib/db/remote-changes"
import { executeRemoteItemOperation } from "@/lib/db/remote-item-commands"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import type { CalendarItemDraft } from "@/types/calendar-item"
import type { RemoteItemChange } from "@/types/remote-sync"
import type { SyncCommand } from "@/types/sync"

const config = getSyncDatabaseTestConfig()
const draft: CalendarItemDraft = {
  kind: "task",
  title: "Test task",
  description: "",
  scheduledDate: "2026-10-08",
  status: "not_started",
  checklist: [],
  recurrence: null,
}
async function write(owner: string, command: SyncCommand, baseRevision = 0) {
  const result = await executeRemoteItemOperation(owner, {
    operationId: randomUUID(),
    protocolVersion: 1,
    baseRevision,
    command,
  })
  if (result.status !== "applied") throw new Error("Expected applied mutation")
  return result
}
async function create(owner: string) {
  return write(owner, {
    type: "item.create",
    itemId: randomUUID(),
    input: draft,
  })
}

describe.skipIf(!config)("checkpointed private change download", () => {
  beforeAll(async () => {
    if (!config) throw new Error("Sync test configuration is required")
    expect((await getDatabase()).databaseName).toBe(config.mongodbDatabase)
  }, 30000)
  afterAll(closeDatabaseConnection)

  test("bootstrap checkpoint and later incremental pages omit no intervening writes", async () => {
    const owner = randomUUID()
    const first = await create(owner)
    const second = await create(owner)
    const page = await readRemoteChanges(owner, { limit: 1 })
    expect(page.through).toBe(2)
    expect(page.nextAfter).toBe(1)
    expect(page.hasMore).toBe(true)
    const edited = await write(
      owner,
      {
        type: "task.set-status",
        itemId: first.item.id,
        occurrenceId: null,
        status: "completed",
      },
      1
    )
    const deleted = await write(
      owner,
      { type: "item.delete", itemId: second.item.id },
      1
    )
    const third = await create(owner)
    const next = await readRemoteChanges(owner, {
      after: page.nextAfter,
      through: page.through,
      limit: 1,
    })
    expect(next.changes.map((change) => change.sequence)).toEqual([2])
    expect(next.changes[0].item.deletedAt).toBeNull()
    expect(next.through).toBe(2)
    expect(next.hasMore).toBe(false)
    const incremental = await readRemoteChanges(owner, {
      after: next.nextAfter,
    })
    expect(incremental.through).toBe(5)
    expect(incremental.changes.map((change) => change.sequence)).toEqual([
      3, 4, 5,
    ])
    expect(incremental.changes.map((change) => change.item)).toEqual([
      edited.item,
      deleted.item,
      third.item,
    ])
    const reconstructed = new Map(
      [...page.changes, ...next.changes, ...incremental.changes].map(
        (change) => [change.item.id, change.item]
      )
    )
    const own = await RemoteItemRepository.open(owner)
    expect(
      [...reconstructed.values()].toSorted((a, b) => (a.id < b.id ? -1 : 1))
    ).toEqual((await own.page()).items)
    expect(await readRemoteChanges(owner, { after: 5, through: 5 })).toEqual({
      changes: [],
      nextAfter: 5,
      through: 5,
      hasMore: false,
    })
  }, 30000)

  test("isolates recipients and rejects future cursors rather than skipping commits", async () => {
    const owner = randomUUID()
    const other = randomUUID()
    const first = await create(owner)
    expect((await readRemoteChanges(owner, {})).changes[0].item).toEqual(
      first.item
    )
    expect(await readRemoteChanges(other, {})).toEqual({
      changes: [],
      nextAfter: 0,
      through: 0,
      hasMore: false,
    })
    await expect(readRemoteChanges(other, { after: 1 })).rejects.toBeInstanceOf(
      RemoteCursorAheadError
    )
    await expect(
      readRemoteChanges(other, { through: 1 })
    ).rejects.toBeInstanceOf(RemoteCursorAheadError)
    await expect(readRemoteChanges(owner, { after: 2 })).rejects.toBeInstanceOf(
      RemoteCursorAheadError
    )
    await expect(readRemoteChanges(owner, { limit: 101 })).rejects.toThrow()
    await expect(
      readRemoteChanges(owner, { recipientUserId: other })
    ).rejects.toThrow()
  }, 30000)

  test("missing, corrupt or currently unauthorized journal payloads never return a partial page", async () => {
    const owner = randomUUID()
    const first = await create(owner)
    await create(owner)
    const journal = await getCollection<RemoteItemChange & { _id: string }>(
      COLLECTION_NAMES.syncChanges
    )
    const document = await journal.findOne({
      recipientUserId: owner,
      sequence: 2,
    })
    if (!document) throw new Error("Expected journal fixture")
    await journal.deleteOne({ _id: document._id })
    try {
      await expect(readRemoteChanges(owner, {})).rejects.toThrow(
        "missing sequence"
      )
    } finally {
      await journal.insertOne(document)
    }
    await journal.updateOne(
      { _id: document._id },
      { $set: { "item.title": 123 as unknown as string } }
    )
    try {
      await expect(readRemoteChanges(owner, {})).rejects.toThrow()
    } finally {
      await journal.replaceOne({ _id: document._id }, document)
    }
    const items = await getCollection<{ _id: string; ownerId: string }>(
      COLLECTION_NAMES.items
    )
    await items.updateOne(
      { _id: first.item.id },
      { $set: { ownerId: randomUUID() } }
    )
    try {
      await expect(readRemoteChanges(owner, {})).rejects.toThrow(
        "access is unavailable"
      )
    } finally {
      await items.updateOne(
        { _id: first.item.id },
        { $set: { ownerId: owner } }
      )
    }
    expect((await readRemoteChanges(owner, {})).changes).toHaveLength(2)
  }, 30000)
})
