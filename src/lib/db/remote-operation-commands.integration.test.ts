import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { pushSyncBatchV2 } from "@/features/sync/push-batch-v2"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { readRemoteChangesV2 } from "@/lib/db/remote-changes-v2"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { executeRemoteOperationV2 } from "@/lib/db/remote-operation-commands"
import { OperationIdentityReuseError } from "@/lib/sync/operation-identity-reuse"
import { validateRemotePushResultV2 } from "@/lib/sync/remote-push-v2"
import { maximumRemotePushResultV2Bytes } from "@/schemas/remote-push-v2"
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

  test("a lost response after a real commit retries the mixed prefix without duplicate effects", async () => {
    const actor = `${prefix}batch-loss`
    const item = itemCreate()
    const tag = tagCreate()
    if (item.command.type !== "item.create" || tag.command.type !== "tag.save")
      throw new Error("Expected creation commands")
    const view = operation({
      type: "item-view.set",
      itemId: item.command.itemId,
      primaryTagId: tag.command.tagId,
    })
    const operations = [item, tag, view]
    const request = { transportVersion: 2, expectedUserId: actor, operations }
    const calls: string[] = []
    const response = await pushSyncBatchV2(request, {
      readActor: async () => actor,
      execute: async (owner, next) => {
        calls.push(next.operationId)
        const result = await executeRemoteOperationV2(owner, next)
        if (next.operationId === tag.operationId)
          throw new Error("Intentional response loss after commit")
        return result
      },
    })
    expect(response.status).toBe("retry_later")
    if (response.status !== "retry_later")
      throw new Error("Expected retry prefix")
    expect(response.results.map((entry) => entry.outcome.operationId)).toEqual([
      item.operationId,
    ])
    expect(response.failedOperationId).toBe(tag.operationId)
    expect(calls).toEqual([item.operationId, tag.operationId])
    const committed = await ledger(actor)
    expect(committed.counter?.sequence).toBe(2)
    expect(committed.receipts).toHaveLength(2)
    const remaining = { ...request, operations: [tag, view] }
    const retry = await pushSyncBatchV2(remaining, {
      readActor: async () => actor,
      execute: executeRemoteOperationV2,
    })
    expect(validateRemotePushResultV2(retry, actor, remaining)).toEqual(retry)
    if (retry.status !== "complete") throw new Error("Expected complete retry")
    expect(
      retry.results.every((entry) => entry.outcome.status === "applied")
    ).toBe(true)
    const history = await ledger(actor)
    expect(history.counter?.sequence).toBe(3)
    expect(history.receipts).toHaveLength(3)
    expect(history.changes.map((entry) => entry.sequence)).toEqual([1, 2, 3])
    expect(
      history.receipts.filter((entry) => entry.operationId === tag.operationId)
    ).toEqual(
      committed.receipts.filter(
        (entry) => entry.operationId === tag.operationId
      )
    )
    expect(
      await pushSyncBatchV2(remaining, {
        readActor: async () => actor,
        execute: executeRemoteOperationV2,
      })
    ).toEqual(retry)
    expect(await ledger(actor)).toEqual(history)
  }, 30000)

  test("mixed batch classifies cross-family identity reuse and denies foreign content", async () => {
    const actor = `${prefix}batch-identity`
    const item = itemCreate()
    const tag = tagCreate()
    await executeRemoteOperationV2(actor, item)
    await executeRemoteOperationV2(actor, tag)
    const history = await ledger(actor)
    const operations = [
      { ...tagCreate(), operationId: item.operationId },
      { ...itemCreate(), operationId: tag.operationId },
    ]
    const request = { transportVersion: 2, expectedUserId: actor, operations }
    const response = await pushSyncBatchV2(request, {
      readActor: async () => actor,
      execute: executeRemoteOperationV2,
    })
    expect(validateRemotePushResultV2(response, actor, request)).toEqual(
      response
    )
    expect(response).toEqual({
      transportVersion: 2,
      status: "complete",
      results: [
        {
          kind: "preference",
          outcome: { operationId: item.operationId, status: "identity_reuse" },
        },
        {
          kind: "item",
          outcome: { operationId: tag.operationId, status: "identity_reuse" },
        },
      ],
    })
    expect(await ledger(actor)).toEqual(history)
    if (item.command.type !== "item.create")
      throw new Error("Expected creation")
    const other = `${prefix}batch-foreign`
    const foreignView = operation({
      type: "item-view.set",
      itemId: item.command.itemId,
      primaryTagId: null,
    })
    expect(
      await pushSyncBatchV2(
        {
          transportVersion: 2,
          expectedUserId: other,
          operations: [foreignView],
        },
        { readActor: async () => other, execute: executeRemoteOperationV2 }
      )
    ).toEqual({
      transportVersion: 2,
      status: "complete",
      results: [
        {
          kind: "preference",
          outcome: {
            operationId: foreignView.operationId,
            status: "unavailable",
          },
        },
      ],
    })
    expect((await ledger(other)).counter).toBeNull()
    expect(await ledger(actor)).toEqual(history)
  }, 30000)

  test("a response excluded by the byte limit is committed once and replayed intact", async () => {
    const actor = `${prefix}batch-bytes`
    const checklist = Array.from({ length: 100 }, () => ({
      id: crypto.randomUUID(),
      text: "漢".repeat(500),
      completed: false,
    }))
    const operations: SyncOperation[] = []
    for (let index = 0; index < 16; index++) {
      const itemId = crypto.randomUUID()
      expect(
        (
          await executeRemoteOperationV2(
            actor,
            operation({
              type: "item.create",
              itemId,
              input: { ...draft, checklist },
            })
          )
        ).outcome.status
      ).toBe("applied")
      operations.push(
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
    }
    const request = { transportVersion: 2, expectedUserId: actor, operations }
    const response = await pushSyncBatchV2(request, {
      readActor: async () => actor,
      execute: executeRemoteOperationV2,
    })
    if (response.status !== "retry_later")
      throw new Error("Expected bounded response prefix")
    const included = response.results.length
    expect(included).toBeGreaterThan(0)
    expect(included).toBeLessThan(operations.length)
    expect(response.failedOperationId).toBe(operations[included].operationId)
    expect(
      new TextEncoder().encode(JSON.stringify(response)).byteLength
    ).toBeLessThanOrEqual(maximumRemotePushResultV2Bytes)
    expect(validateRemotePushResultV2(response, actor, request)).toEqual(
      response
    )
    const history = await ledger(actor)
    expect(history.counter?.sequence).toBe(16 + included + 1)
    expect(
      history.receipts.some(
        (entry) => entry.operationId === response.failedOperationId
      )
    ).toBe(true)
    const excluded = await executeRemoteOperationV2(actor, operations[included])
    expect(excluded.outcome.status).toBe("applied")
    expect(await ledger(actor)).toEqual(history)
    const remaining = { ...request, operations: operations.slice(included) }
    const retry = await pushSyncBatchV2(remaining, {
      readActor: async () => actor,
      execute: executeRemoteOperationV2,
    })
    if (retry.status !== "complete")
      throw new Error("Expected complete remaining response")
    expect(retry.results[0]).toEqual(excluded)
    for (const entry of [...response.results, ...retry.results]) {
      if (
        entry.kind !== "item" ||
        entry.outcome.status !== "applied" ||
        entry.outcome.item.kind !== "task"
      )
        throw new Error("Expected complete task outcome")
      expect(entry.outcome.item.checklist).toEqual(checklist)
      expect(entry.outcome.item.status).toBe("in_progress")
      expect(entry.outcome.item.revision).toBe(2)
    }
    const completed = await ledger(actor)
    expect(completed.counter?.sequence).toBe(32)
    expect(completed.receipts).toHaveLength(32)
    expect(completed.changes.map((entry) => entry.sequence)).toEqual(
      Array.from({ length: 32 }, (_, index) => index + 1)
    )
    expect(
      completed.receipts.find(
        (entry) => entry.operationId === response.failedOperationId
      )
    ).toEqual(
      history.receipts.find(
        (entry) => entry.operationId === response.failedOperationId
      )
    )
  }, 30000)
})
