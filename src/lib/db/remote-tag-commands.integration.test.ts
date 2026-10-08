import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { executeRemoteItemOperation } from "@/lib/db/remote-item-commands"
import { readRemoteOperationReceipt } from "@/lib/db/remote-operation-receipts"
import {
  executeRemoteTagOperation,
  stageRemoteTagOperation,
} from "@/lib/db/remote-tag-commands"
import { RemoteTagRepository } from "@/lib/db/remote-tags"
import { OperationIdentityReuseError } from "@/lib/sync/operation-identity-reuse"
import { remoteChangeV2Schema } from "@/schemas/remote-change-v2"
import type { Tag } from "@/types/preferences"
import type { SyncCommand, SyncOperation } from "@/types/sync"

const config = getSyncDatabaseTestConfig()
const prefix = `tag-command-${config?.runId}-`
const timestamp = "2026-10-08T00:00:00.000Z"
function operation(command: SyncCommand, baseRevision = 0): SyncOperation {
  return {
    operationId: crypto.randomUUID(),
    protocolVersion: 1,
    baseRevision,
    command,
  }
}
function create(name = "Category") {
  return operation({
    type: "tag.save",
    tagId: crypto.randomUUID(),
    input: { name, color: "#123456", position: 1024 },
  })
}
async function ownedDatabase() {
  if (!config) throw new Error("Sync test configuration is required")
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Category command database does not match its owned run")
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
async function compactCatalog(actor: string) {
  const repository = await RemoteTagRepository.open(actor)
  const tags: Tag[] = [0, 1, 2].map((index) => ({
    id: `00000000-0000-4000-8000-00000000000${index}`,
    userId: actor,
    name: `Category ${index}`,
    normalizedName: `category ${index}`,
    color: "#123456",
    position: index === 2 ? 1024 : 0,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }))
  for (const tag of tags) expect(await repository.insert(tag)).toBe(true)
  const move = operation(
    {
      type: "tag.move",
      tagId: tags[2].id,
      beforeId: tags[1].id,
      afterId: tags[0].id,
    },
    1
  )
  return { repository, tags, move }
}

describe.skipIf(!config)("atomic remote category commands", () => {
  beforeAll(async () => {
    const database = await ownedDatabase()
    await ensureIndexes(
      database,
      INDEX_SPECS.filter((spec) => spec.collection === COLLECTION_NAMES.tags)
    )
  }, 30000)
  afterAll(async () => {
    try {
      await ownedDatabase()
      for (const [collection, key] of [
        [COLLECTION_NAMES.items, "ownerId"],
        [COLLECTION_NAMES.tags, "userId"],
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

  test("commits once under duplicate delivery and replays without writing history", async () => {
    const actor = `${prefix}replay`
    const first = create()
    const [left, right] = await Promise.all([
      executeRemoteTagOperation(actor, first),
      executeRemoteTagOperation(actor, first),
    ])
    expect(left).toEqual(right)
    expect(left.kind).toBe("preference")
    expect(left.outcome.status).toBe("applied")
    const original = await history(actor)
    expect(original.receipts).toBe(1)
    expect(original.changes).toHaveLength(1)
    expect(original.counter?.sequence).toBe(1)
    const { _id, ...change } = original.changes[0]
    expect(remoteChangeV2Schema.parse(change).kind).toBe("preference")
    expect(
      (await readRemoteOperationReceipt(actor, first.operationId))?.result
    ).toEqual(left)
    expect(await executeRemoteTagOperation(actor, first)).toEqual(left)
    await expect(
      executeRemoteTagOperation(actor, { ...first, baseRevision: 1 })
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
    expect(await history(actor)).toEqual(original)
    expect(
      (await (await RemoteTagRepository.open(actor)).catalog())[0].revision
    ).toBe(1)
    await expect(executeRemoteTagOperation("", first)).rejects.toThrow()
    await expect(
      executeRemoteTagOperation(actor, { ...first, extra: true })
    ).rejects.toThrow()
  }, 30000)

  test("conflicts and name rejection create no applied sequence and preserve tombstones", async () => {
    const actor = `${prefix}cas`
    const first = create("Work")
    await executeRemoteTagOperation(actor, first)
    const stale = operation(first.command)
    expect((await executeRemoteTagOperation(actor, stale)).outcome.status).toBe(
      "conflict"
    )
    expect(
      (await executeRemoteTagOperation(actor, create("ＷＯＲＫ"))).outcome
        .status
    ).toBe("invalid_command")
    if (first.command.type !== "tag.save")
      throw new Error("Expected category command")
    const deletion = operation(
      { type: "tag.delete", tagId: first.command.tagId },
      1
    )
    const deleted = await executeRemoteTagOperation(actor, deletion)
    expect(deleted.outcome.status).toBe("applied")
    const repository = await RemoteTagRepository.open(actor)
    const tombstone = await repository.read(first.command.tagId)
    expect(tombstone?.revision).toBe(2)
    expect(tombstone?.deletedAt).not.toBeNull()
    expect(
      (await executeRemoteTagOperation(actor, operation(first.command, 2)))
        .outcome.status
    ).toBe("conflict")
    const receipt = await readRemoteOperationReceipt(actor, first.operationId)
    if (!receipt) throw new Error("Expected committed category receipt")
    expect(await executeRemoteTagOperation(actor, first)).toEqual(
      receipt.result
    )
    expect(
      (await executeRemoteTagOperation(actor, create("Work"))).outcome.status
    ).toBe("applied")
    const state = await history(actor)
    expect(state.counter?.sequence).toBe(3)
    expect(state.changes).toHaveLength(3)
    expect(state.receipts).toBe(6)
    expect(await repository.read(first.command.tagId)).toEqual(tombstone)
    const other = `${prefix}other`
    expect(
      (await executeRemoteTagOperation(other, deletion)).outcome.status
    ).toBe("unavailable")
    expect((await history(other)).counter).toBeNull()
    const unsupported = operation(
      { type: "item.delete", itemId: crypto.randomUUID() },
      1
    )
    expect(
      (await executeRemoteTagOperation(actor, unsupported)).outcome.status
    ).toBe("unsupported")
    expect(
      await readRemoteOperationReceipt(actor, unsupported.operationId)
    ).toBeNull()
  }, 30000)

  test("compaction journals all revisions once and a late failure rolls back every write", async () => {
    const actor = `${prefix}rollback`
    const { repository, tags, move } = await compactCatalog(actor)
    const database = await ownedDatabase()
    await database.client.withSession(async (session) => {
      await expect(
        stageRemoteTagOperation(actor, move, timestamp, session)
      ).rejects.toThrow("active transaction")
      await expect(
        session.withTransaction(async () => {
          const staged = await stageRemoteTagOperation(
            actor,
            move,
            timestamp,
            session
          )
          if (
            staged.kind !== "preference" ||
            staged.outcome.status !== "applied"
          )
            throw new Error("Expected staged category changes")
          expect(staged.outcome.effects.effects).toHaveLength(3)
          expect(
            staged.outcome.effects.effects.every(
              (effect) => effect.record.revision === 2
            )
          ).toBe(true)
          expect(
            (await readRemoteOperationReceipt(actor, move.operationId, session))
              ?.result
          ).toEqual(staged)
          expect(
            await readRemoteOperationReceipt(actor, move.operationId)
          ).toBeNull()
          throw new Error("Intentional failure after category receipt")
        })
      ).rejects.toThrow("Intentional failure after category receipt")
    })
    expect(
      (await repository.catalog()).toSorted((a, b) => a.id.localeCompare(b.id))
    ).toEqual(tags)
    expect(await history(actor)).toEqual({
      receipts: 0,
      changes: [],
      counter: null,
    })
    const committed = await executeRemoteTagOperation(actor, move)
    if (
      committed.kind !== "preference" ||
      committed.outcome.status !== "applied"
    )
      throw new Error("Expected committed category changes")
    expect(committed.outcome.effects.effects).toHaveLength(3)
    expect((await history(actor)).changes).toHaveLength(1)
    expect((await history(actor)).counter?.sequence).toBe(1)
    expect(await executeRemoteTagOperation(actor, move)).toEqual(committed)
    expect(await repository.catalog()).toEqual(
      committed.outcome.effects.effects
        .map((effect) => {
          if (effect.store !== "tags")
            throw new Error("Expected category effect")
          return effect.record
        })
        .toSorted((a, b) =>
          "id" in a && "id" in b ? a.id.localeCompare(b.id) : 0
        )
    )
  }, 30000)

  test("shares the existing item sequence and receipt namespace without rewriting legacy records", async () => {
    const actor = `${prefix}mixed-history`
    const itemId = crypto.randomUUID()
    const first = operation({
      type: "item.create",
      itemId,
      input: {
        kind: "task",
        title: "Owned test task",
        description: "",
        scheduledDate: "2026-10-08",
        status: "not_started",
        checklist: [],
        recurrence: null,
      },
    })
    const item = await executeRemoteItemOperation(actor, first)
    if (item.status !== "applied") throw new Error("Expected committed item")
    expect(item.sequence).toBe(1)
    const category = await executeRemoteTagOperation(actor, create())
    if (category.kind !== "preference" || category.outcome.status !== "applied")
      throw new Error("Expected committed category")
    expect(category.outcome.effects.sequence).toBe(2)
    expect(await executeRemoteTagOperation(actor, first)).toEqual({
      kind: "item",
      outcome: item,
    })
    await expect(
      executeRemoteTagOperation(actor, {
        ...create(),
        operationId: first.operationId,
      })
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
    const next = await executeRemoteItemOperation(
      actor,
      operation(
        {
          type: "task.set-status",
          itemId,
          occurrenceId: null,
          status: "in_progress",
        },
        1
      )
    )
    if (next.status !== "applied")
      throw new Error("Expected committed item status")
    expect(next.sequence).toBe(3)
    const stored = await history(actor)
    expect(stored.receipts).toBe(3)
    expect(stored.changes.map((change) => change.sequence)).toEqual([1, 2, 3])
    expect(stored.changes[0].version).toBeUndefined()
    expect(stored.changes[1].version).toBe(2)
    expect(stored.changes[2].version).toBeUndefined()
  }, 30000)
})
