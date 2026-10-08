import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import {
  executeRemoteItemOperation,
  OperationIdentityReuseError,
} from "@/lib/db/remote-item-commands"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { executeRemoteTagOperation } from "@/lib/db/remote-tag-commands"
import type { CalendarItemDraft } from "@/types/calendar-item"
import type { SyncCommand, SyncOperation } from "@/types/sync"

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
function operation(command: SyncCommand, baseRevision = 0): SyncOperation {
  return {
    operationId: randomUUID(),
    protocolVersion: 1,
    baseRevision,
    command,
  }
}
function create(input = draft) {
  return operation({ type: "item.create", itemId: randomUUID(), input })
}
async function records(owner: string) {
  const receipts = await getCollection<{ actorUserId: string }>(
    COLLECTION_NAMES.syncOperations
  )
  const changes = await getCollection<{
    recipientUserId: string
    sequence: number
  }>(COLLECTION_NAMES.syncChanges)
  const counters = await getCollection<{ _id: string; sequence: number }>(
    COLLECTION_NAMES.syncCounters
  )
  return {
    receipts: await receipts.countDocuments({ actorUserId: owner }),
    changes: await changes
      .find({ recipientUserId: owner })
      .sort({ sequence: 1 })
      .toArray(),
    sequence: (await counters.findOne({ _id: owner }))?.sequence ?? 0,
  }
}

describe.skipIf(!config)("atomic remote item commands", () => {
  beforeAll(async () => {
    if (!config) throw new Error("Sync test configuration is required")
    expect((await getDatabase()).databaseName).toBe(config.mongodbDatabase)
  }, 30000)
  afterAll(closeDatabaseConnection)

  test("concurrent retries and replay after deletion never repeat a mutation", async () => {
    const owner = randomUUID()
    const first = create()
    const results = await Promise.all(
      Array.from({ length: 4 }, () => executeRemoteItemOperation(owner, first))
    )
    expect(
      results.every(
        (result) => JSON.stringify(result) === JSON.stringify(results[0])
      )
    ).toBe(true)
    const saved = results[0]
    if (saved.status !== "applied") throw new Error("Expected applied creation")
    expect(saved.item.revision).toBe(1)
    expect(saved.item.ownerId).toBe(owner)
    expect(saved.sequence).toBe(1)
    const remove = operation({ type: "item.delete", itemId: saved.item.id }, 1)
    const deleted = await executeRemoteItemOperation(owner, remove)
    expect(deleted.status).toBe("applied")
    expect(await executeRemoteItemOperation(owner, first)).toEqual(saved)
    await expect(
      executeRemoteItemOperation(owner, {
        ...first,
        command: {
          ...first.command,
          input: { ...draft, title: "Changed payload" },
        },
      })
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
    const repo = await RemoteItemRepository.open(owner)
    expect((await repo.read(saved.item.id))?.deletedAt).not.toBeNull()
    const counts = await records(owner)
    expect(counts.receipts).toBe(2)
    expect(counts.changes).toHaveLength(2)
    expect(counts.sequence).toBe(2)
    const receipts = await getCollection<{
      actorUserId: string
      operationId: string
      result: unknown
    }>(COLLECTION_NAMES.syncOperations)
    const key = { actorUserId: owner, operationId: first.operationId }
    await receipts.updateOne(key, {
      $set: {
        result: { ...saved, item: { ...saved.item, ownerId: randomUUID() } },
      },
    })
    try {
      await expect(executeRemoteItemOperation(owner, first)).rejects.toThrow()
    } finally {
      await receipts.updateOne(key, { $set: { result: saved } })
    }
  }, 30000)

  test("two editors conflict safely and the conflict receipt remains stable", async () => {
    const owner = randomUUID()
    const created = await executeRemoteItemOperation(owner, create())
    if (created.status !== "applied")
      throw new Error("Expected applied creation")
    const edits = ["in_progress", "completed"].map((status) =>
      operation(
        {
          type: "task.set-status",
          itemId: created.item.id,
          occurrenceId: null,
          status: status as "in_progress" | "completed",
        },
        1
      )
    )
    const results = await Promise.all(
      edits.map((edit) => executeRemoteItemOperation(owner, edit))
    )
    expect(results.map((result) => result.status).toSorted()).toEqual([
      "applied",
      "conflict",
    ])
    const conflictIndex = results.findIndex(
      (result) => result.status === "conflict"
    )
    await executeRemoteItemOperation(
      owner,
      operation({ type: "item.delete", itemId: created.item.id }, 2)
    )
    expect(
      await executeRemoteItemOperation(owner, edits[conflictIndex])
    ).toEqual(results[conflictIndex])
    const counts = await records(owner)
    expect(counts.receipts).toBe(4)
    expect(counts.changes.map((change) => change.sequence)).toEqual([1, 2, 3])
  }, 30000)

  test("isolates actors and serializes independent commits per recipient", async () => {
    const owner = randomUUID()
    const other = randomUUID()
    const first = create()
    const saved = await executeRemoteItemOperation(owner, first)
    if (saved.status !== "applied") throw new Error("Expected applied creation")
    expect(
      await executeRemoteItemOperation(
        other,
        operation({ type: "item.delete", itemId: saved.item.id }, 1)
      )
    ).toMatchObject({ status: "unavailable" })
    expect(await executeRemoteItemOperation(other, first)).toMatchObject({
      status: "unavailable",
    })
    expect(
      await (await RemoteItemRepository.open(other)).read(saved.item.id)
    ).toBeNull()
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        executeRemoteItemOperation(owner, create())
      )
    )
    expect(results.every((result) => result.status === "applied")).toBe(true)
    const counts = await records(owner)
    expect(counts.changes.map((change) => change.sequence)).toEqual([
      1, 2, 3, 4, 5, 6,
    ])
    expect(counts.receipts).toBe(6)
    expect(counts.sequence).toBe(6)
    const foreign = await records(other)
    expect(foreign.receipts).toBe(2)
    expect(foreign.sequence).toBe(0)
    expect(foreign.changes).toEqual([])
    const ownCreate = {
      ...first,
      command: {
        type: "item.create" as const,
        itemId: randomUUID(),
        input: draft,
      },
    }
    // A receipt collision is scoped to an actor, including rejected operations.
    await expect(
      executeRemoteItemOperation(other, ownCreate)
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
    expect(
      (await (await RemoteItemRepository.open(owner)).read(saved.item.id))
        ?.revision
    ).toBe(1)
  }, 30000)

  test("unsupported and invalid commands cannot become successful acknowledgements", async () => {
    const owner = randomUUID()
    const recurrence = {
      frequency: "daily" as const,
      interval: 1,
      anchorDate: "2026-10-08",
      timeZone: "Europe/Madrid",
      end: { type: "never" as const },
    }
    const commands = [
      create({ ...draft, recurrence }),
      create({
        kind: "birthday",
        title: "Test birthday",
        description: "",
        month: 10,
        day: 8,
        birthYear: null,
        timeZone: "Europe/Madrid",
      }),
      operation({
        type: "item-view.set",
        itemId: randomUUID(),
        primaryTagId: null,
      }),
    ]
    for (const command of commands)
      expect((await executeRemoteItemOperation(owner, command)).status).toBe(
        "unsupported"
      )
    expect((await records(owner)).receipts).toBe(0)
    const gap = create({
      kind: "event",
      title: "Invalid local time",
      description: "",
      recurrence: null,
      schedule: {
        mode: "timed",
        localStart: "2026-03-29T02:30",
        localEnd: null,
        timeZone: "Europe/Madrid",
      },
    })
    expect((await executeRemoteItemOperation(owner, gap)).status).toBe(
      "invalid_command"
    )
    const created = await executeRemoteItemOperation(owner, create())
    if (created.status !== "applied")
      throw new Error("Expected applied creation")
    const invalid = operation(
      {
        type: "task.set-checklist-entry",
        itemId: created.item.id,
        occurrenceId: null,
        entryId: randomUUID(),
        completed: true,
      },
      1
    )
    expect((await executeRemoteItemOperation(owner, invalid)).status).toBe(
      "invalid_command"
    )
    expect((await records(owner)).changes).toHaveLength(1)
    await expect(
      executeRemoteItemOperation(owner, {
        ...create(),
        actorUserId: randomUUID(),
      })
    ).rejects.toThrow()
  }, 30000)

  test("valid event edits and tombstones preserve server identity and revision", async () => {
    const owner = randomUUID()
    const input: CalendarItemDraft = {
      kind: "event",
      title: "Test event",
      description: "",
      recurrence: null,
      schedule: {
        mode: "all_day",
        startDate: "2026-10-08",
        endDateExclusive: "2026-10-09",
      },
    }
    const first = await executeRemoteItemOperation(owner, create(input))
    if (first.status !== "applied") throw new Error("Expected applied creation")
    const update = operation(
      {
        type: "item.update",
        itemId: first.item.id,
        input: { ...input, title: "Edited event" },
      },
      1
    )
    const second = await executeRemoteItemOperation(owner, update)
    if (second.status !== "applied") throw new Error("Expected applied update")
    expect(second.item).toMatchObject({
      id: first.item.id,
      ownerId: owner,
      createdAt: first.item.createdAt,
      revision: 2,
      title: "Edited event",
    })
    const wrongKind = operation(
      { type: "item.update", itemId: first.item.id, input: draft },
      2
    )
    expect((await executeRemoteItemOperation(owner, wrongKind)).status).toBe(
      "invalid_command"
    )
    const progress = operation(
      {
        type: "task.set-status",
        itemId: first.item.id,
        occurrenceId: null,
        status: "completed",
      },
      2
    )
    expect((await executeRemoteItemOperation(owner, progress)).status).toBe(
      "invalid_command"
    )
    const deleted = await executeRemoteItemOperation(
      owner,
      operation({ type: "item.delete", itemId: first.item.id }, 2)
    )
    if (deleted.status !== "applied")
      throw new Error("Expected applied deletion")
    expect(deleted.item.deletedAt).not.toBeNull()
    expect(deleted.item.revision).toBe(3)
    expect(
      (
        await executeRemoteItemOperation(
          owner,
          operation({ type: "item.update", itemId: first.item.id, input }, 3)
        )
      ).status
    ).toBe("conflict")
  }, 30000)

  test("a late journal failure rolls back item, receipt and counter then recovers", async () => {
    const owner = randomUUID()
    const first = create()
    const database = await getDatabase()
    await database.command({
      collMod: COLLECTION_NAMES.syncChanges,
      validator: { sequence: { $lt: 0 } },
      validationLevel: "strict",
      validationAction: "error",
    })
    try {
      await expect(executeRemoteItemOperation(owner, first)).rejects.toThrow()
      if (first.command.type !== "item.create")
        throw new Error("Expected creation")
      expect(
        await (await RemoteItemRepository.open(owner)).read(
          first.command.itemId
        )
      ).toBeNull()
      const counts = await records(owner)
      expect(counts.receipts).toBe(0)
      expect(counts.changes).toEqual([])
      expect(counts.sequence).toBe(0)
    } finally {
      await database.command({
        collMod: COLLECTION_NAMES.syncChanges,
        validator: {},
      })
    }
    expect(await executeRemoteItemOperation(owner, first)).toMatchObject({
      status: "applied",
      sequence: 1,
    })
    expect((await records(owner)).receipts).toBe(1)
  }, 30000)

  test("replays versioned item receipts without rewriting history and rejects corrupt envelopes", async () => {
    const owner = randomUUID()
    const first = create()
    const saved = await executeRemoteItemOperation(owner, first)
    if (saved.status !== "applied") throw new Error("Expected applied creation")
    const receipts = await getCollection<{
      _id: string
      [key: string]: unknown
    }>(COLLECTION_NAMES.syncOperations)
    const stored = await receipts.findOne({
      actorUserId: owner,
      operationId: first.operationId,
    })
    if (!stored) throw new Error("Expected durable receipt")
    const { _id, ...legacy } = stored
    const versioned = {
      ...legacy,
      version: 2,
      result: { kind: "item", outcome: saved },
    }
    await receipts.replaceOne({ _id }, versioned)
    try {
      expect(await executeRemoteItemOperation(owner, first)).toEqual(saved)
      await executeRemoteItemOperation(
        owner,
        operation({ type: "item.delete", itemId: saved.item.id }, 1)
      )
      const history = await records(owner)
      const replay = await executeRemoteItemOperation(owner, first)
      expect(replay).toEqual(saved)
      if (replay.status !== "applied")
        throw new Error("Expected applied replay")
      replay.item.title = "Mutated returned value"
      expect(await executeRemoteItemOperation(owner, first)).toEqual(saved)
      expect(await records(owner)).toEqual(history)
      expect(await receipts.findOne({ _id })).toEqual({ _id, ...versioned })
      for (const corruption of [
        { version: 3 },
        { "result.outcome.item.ownerId": randomUUID() },
      ]) {
        await receipts.updateOne({ _id }, { $set: corruption })
        try {
          await expect(
            executeRemoteItemOperation(owner, first)
          ).rejects.toThrow()
          expect(await records(owner)).toEqual(history)
        } finally {
          await receipts.replaceOne({ _id }, versioned)
        }
      }
    } finally {
      await receipts.replaceOne({ _id }, legacy)
    }
    expect(await receipts.findOne({ _id })).toEqual(stored)
  }, 30000)

  test("personal receipt identity is checked before legacy outcome compatibility without new effects", async () => {
    const database = await getDatabase()
    await ensureIndexes(
      database,
      INDEX_SPECS.filter((spec) => spec.collection === COLLECTION_NAMES.tags)
    )
    const owner = randomUUID()
    const tag = operation({
      type: "tag.save",
      tagId: randomUUID(),
      input: { name: "Receipt category", color: "#123456", position: 1024 },
    })
    expect((await executeRemoteTagOperation(owner, tag)).kind).toBe(
      "preference"
    )
    const history = await records(owner)
    const receipts = await getCollection<{
      _id: string
      [key: string]: unknown
    }>(COLLECTION_NAMES.syncOperations)
    const stored = await receipts.findOne({
      actorUserId: owner,
      operationId: tag.operationId,
    })
    expect(stored?.version).toBe(2)
    const reused = { ...create(), operationId: tag.operationId }
    await expect(
      executeRemoteItemOperation(owner, reused)
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
    await expect(executeRemoteItemOperation(owner, tag)).rejects.toThrow(
      "Stored receipt is incompatible with the item executor"
    )
    expect(await records(owner)).toEqual(history)
    expect(
      await receipts.findOne({
        actorUserId: owner,
        operationId: tag.operationId,
      })
    ).toEqual(stored)
    if (reused.command.type !== "item.create")
      throw new Error("Expected creation")
    expect(
      await (await RemoteItemRepository.open(owner)).read(reused.command.itemId)
    ).toBeNull()
    const other = randomUUID()
    expect(await executeRemoteItemOperation(other, reused)).toMatchObject({
      status: "applied",
      sequence: 1,
    })
    expect(await records(owner)).toEqual(history)
  }, 30000)
})
