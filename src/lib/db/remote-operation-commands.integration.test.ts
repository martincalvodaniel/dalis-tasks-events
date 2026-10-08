import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { readRemoteChangesV2 } from "@/lib/db/remote-changes-v2"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { executeRemoteOperationV2 } from "@/lib/db/remote-operation-commands"
import { OperationIdentityReuseError } from "@/lib/sync/operation-identity-reuse"
import type { CalendarItemDraft } from "@/types/calendar-item"
import type { SyncCommand, SyncOperation } from "@/types/sync"

const config = getSyncDatabaseTestConfig()
const prefix = `operation-dispatch-${config?.runId}-`
const draft: CalendarItemDraft = {
  kind: "task",
  title: "Dispatcher task",
  description: "",
  scheduledDate: "2026-10-08",
  status: "not_started",
  checklist: [],
  recurrence: null,
}
function operation(command: SyncCommand, baseRevision = 0): SyncOperation {
  return {
    operationId: crypto.randomUUID(),
    protocolVersion: 1,
    baseRevision,
    command,
  }
}
function itemCreate() {
  return operation({
    type: "item.create",
    itemId: crypto.randomUUID(),
    input: draft,
  })
}
function tagCreate() {
  return operation({
    type: "tag.save",
    tagId: crypto.randomUUID(),
    input: { name: "Dispatcher category", color: "#123456", position: 1024 },
  })
}
async function ownedDatabase() {
  if (!config) throw new Error("Sync test configuration is required")
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Dispatcher database does not match its owned run")
  return database
}
async function ledger(actor: string) {
  return {
    receipts: await (await getCollection(COLLECTION_NAMES.syncOperations))
      .find({ actorUserId: actor })
      .sort({ operationId: 1 })
      .toArray(),
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

describe.skipIf(!config)("prepared mixed operation dispatcher", () => {
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

  test("routes mixed committed effects and preserves late replay after deletion", async () => {
    const actor = `${prefix}mixed`
    const item = itemCreate()
    const tag = tagCreate()
    if (item.command.type !== "item.create" || tag.command.type !== "tag.save")
      throw new Error("Expected creation commands")
    const view = operation({
      type: "item-view.set",
      itemId: item.command.itemId,
      primaryTagId: tag.command.tagId,
    })
    const saved = []
    for (const next of [item, tag, view])
      saved.push(await executeRemoteOperationV2(actor, next))
    expect(saved.map((entry) => entry.kind)).toEqual([
      "item",
      "preference",
      "preference",
    ])
    expect(saved.every((entry) => entry.outcome.status === "applied")).toBe(
      true
    )
    const page = await readRemoteChangesV2(actor, { after: 0, limit: 100 })
    expect(page.changes.map((entry) => entry.kind)).toEqual([
      "item",
      "preference",
      "preference",
    ])
    expect(page.changes.map((entry) => entry.sequence)).toEqual([1, 2, 3])
    expect(
      (
        await executeRemoteOperationV2(
          actor,
          operation({ type: "item.delete", itemId: item.command.itemId }, 1)
        )
      ).outcome.status
    ).toBe("applied")
    const history = await ledger(actor)
    for (const [index, next] of [item, tag, view].entries())
      expect(await executeRemoteOperationV2(actor, next)).toEqual(saved[index])
    expect(await ledger(actor)).toEqual(history)
    expect(
      (await (await RemoteItemRepository.open(actor)).read(item.command.itemId))
        ?.deletedAt
    ).not.toBeNull()
  }, 30000)

  test("rejects identity reuse in both family directions while isolating actors", async () => {
    const actor = `${prefix}identity`
    const item = itemCreate()
    const tag = tagCreate()
    await executeRemoteOperationV2(actor, item)
    await executeRemoteOperationV2(actor, tag)
    const history = await ledger(actor)
    await expect(
      executeRemoteOperationV2(actor, {
        ...tagCreate(),
        operationId: item.operationId,
      })
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
    const reused = { ...itemCreate(), operationId: tag.operationId }
    await expect(
      executeRemoteOperationV2(actor, reused)
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
    expect(await ledger(actor)).toEqual(history)
    expect(
      (await executeRemoteOperationV2(`${prefix}other`, reused)).outcome.status
    ).toBe("applied")
    expect(await ledger(actor)).toEqual(history)
  }, 30000)

  test("unsupported personal commands and invalid intentions never produce successful effects", async () => {
    const actor = `${prefix}unsupported`
    const commands: SyncCommand[] = [
      {
        type: "settings.update",
        input: { timeZone: "Europe/Madrid", weekStartsOn: 1, locale: "es-ES" },
      },
      {
        type: "task.move",
        itemId: crypto.randomUUID(),
        occurrenceId: null,
        scope: "day",
        date: "2026-10-08",
        tagId: null,
        beforeId: null,
        afterId: null,
      },
    ]
    for (const command of commands) {
      const next = operation(command)
      expect(await executeRemoteOperationV2(actor, next)).toEqual({
        kind: "preference",
        outcome: { operationId: next.operationId, status: "unsupported" },
      })
    }
    for (const invalid of [
      { ...itemCreate(), protocolVersion: 2 },
      { ...itemCreate(), unexpected: true },
    ])
      await expect(executeRemoteOperationV2(actor, invalid)).rejects.toThrow()
    await expect(executeRemoteOperationV2("", itemCreate())).rejects.toThrow()
    expect(await ledger(actor)).toEqual({
      receipts: [],
      changes: [],
      counter: null,
    })
    const known = tagCreate()
    await executeRemoteOperationV2(actor, known)
    const history = await ledger(actor)
    await expect(
      executeRemoteOperationV2(actor, {
        ...operation(commands[0]),
        operationId: known.operationId,
      })
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
    expect(await ledger(actor)).toEqual(history)
  }, 30000)

  test("never relabels an incompatible historical family into a new acknowledgement", async () => {
    const actor = `${prefix}family`
    const tag = tagCreate()
    await executeRemoteOperationV2(actor, tag)
    const receipts = await getCollection<{
      _id: string
      [key: string]: unknown
    }>(COLLECTION_NAMES.syncOperations)
    const stored = await receipts.findOne({
      actorUserId: actor,
      operationId: tag.operationId,
    })
    if (!stored) throw new Error("Expected personal receipt")
    const { _id, ...original } = stored
    const incompatible = {
      ...original,
      result: {
        kind: "item",
        outcome: { operationId: tag.operationId, status: "unsupported" },
      },
    }
    await receipts.replaceOne({ _id }, incompatible)
    try {
      const history = await ledger(actor)
      await expect(executeRemoteOperationV2(actor, tag)).rejects.toThrow(
        "Stored outcome is incompatible with its operation family"
      )
      expect(await ledger(actor)).toEqual(history)
    } finally {
      await receipts.replaceOne({ _id }, original)
    }
    expect(await receipts.findOne({ _id })).toEqual(stored)
  }, 30000)
})
