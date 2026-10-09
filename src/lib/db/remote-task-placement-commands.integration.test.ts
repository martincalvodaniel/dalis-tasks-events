import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { applyItemCommand } from "@/lib/calendar/item-command"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { RemoteItemViewRepository } from "@/lib/db/remote-item-views"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { readRemoteOperationReceipt } from "@/lib/db/remote-operation-receipts"
import { RemoteTagRepository } from "@/lib/db/remote-tags"
import {
  executeRemoteTaskPlacementOperation,
  stageRemoteTaskPlacementOperation,
} from "@/lib/db/remote-task-placement-commands"
import { RemoteTaskPlacementRepository } from "@/lib/db/remote-task-placements"
import { OperationIdentityReuseError } from "@/lib/sync/operation-identity-reuse"
import { overduePlacementDate } from "@/schemas/ordering"
import type { CalendarItemDraft } from "@/types/calendar-item"
import type { ItemView, TaskPlacement } from "@/types/preferences"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"
import type { SyncCommand } from "@/types/sync"

const config = getSyncDatabaseTestConfig()
const prefix = `placement-command-${config?.runId}-`
const timestamp = "2026-10-09T00:00:00.000Z"
const later = "2026-11-09T00:00:00.000Z"
const task: CalendarItemDraft = {
  kind: "task",
  title: "Owned task",
  description: "Preserved content",
  scheduledDate: "2026-10-09",
  status: "in_progress",
  checklist: [],
  recurrence: null,
}
type MoveCommand = Extract<SyncCommand, { type: "task.move" }>
function move(itemId: string, tagId: string | null = null, baseRevision = 0) {
  return {
    protocolVersion: 1 as const,
    operationId: crypto.randomUUID(),
    baseRevision,
    command: {
      type: "task.move",
      itemId,
      occurrenceId: null,
      scope: "day",
      date: "2026-10-09",
      tagId,
      beforeId: null,
      afterId: null,
    } as MoveCommand,
  }
}
async function itemFixture(actor: string, input = task) {
  const item = applyItemCommand(
    null,
    {
      type: "item.create",
      itemId: crypto.randomUUID(),
      input,
    },
    actor,
    timestamp
  )
  item.revision = 1
  expect(await (await RemoteItemRepository.open(actor)).insert(item)).toBe(true)
  return item
}
async function tagFixture(actor: string, name = "Own") {
  const tag = {
    id: crypto.randomUUID(),
    userId: actor,
    name,
    normalizedName: name.toLowerCase(),
    color: "#123456",
    position: 0,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  expect(await (await RemoteTagRepository.open(actor)).insert(tag)).toBe(true)
  return tag
}
function view(actor: string, itemId: string, tagId: string | null): ItemView {
  return {
    userId: actor,
    itemId,
    primaryTagId: tagId,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
}
function placement(
  actor: string,
  itemId: string,
  tagId: string | null,
  position = 0
): TaskPlacement {
  return {
    userId: actor,
    occurrenceId: itemId,
    scope: "day",
    date: "2026-10-09",
    tagId,
    position,
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
async function ownedDatabase() {
  if (!config) throw new Error("Sync test configuration is required")
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Placement command database does not match its owned run")
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
function applied(result: RemoteOperationResultV2) {
  if (result.kind !== "preference" || result.outcome.status !== "applied")
    throw new Error("Expected applied task placement effects")
  return result.outcome.effects
}
async function compactionFixture(actor: string) {
  const item = await itemFixture(actor)
  const peer = await itemFixture(actor)
  const tag = await tagFixture(actor)
  const peerView = view(actor, peer.id, tag.id)
  const peerPlacement = placement(actor, peer.id, tag.id, 1e12)
  expect(
    await (await RemoteItemViewRepository.open(actor)).insert(peerView)
  ).toBe(true)
  expect(
    await (await RemoteTaskPlacementRepository.open(actor)).insert(
      peerPlacement
    )
  ).toBe(true)
  const operation = move(item.id, tag.id)
  operation.command.afterId = peer.id
  return { item, peer, tag, peerView, peerPlacement, operation }
}

describe.skipIf(!config)("atomic remote task placement commands", () => {
  beforeAll(async () => {
    const database = await ownedDatabase()
    await ensureIndexes(
      database,
      INDEX_SPECS.filter(
        (spec) =>
          spec.collection === COLLECTION_NAMES.tags ||
          spec.collection === COLLECTION_NAMES.itemViews ||
          spec.collection === COLLECTION_NAMES.taskPlacements
      )
    )
  }, 30000)
  afterAll(async () => {
    try {
      await ownedDatabase()
      for (const [collection, field] of [
        [COLLECTION_NAMES.items, "ownerId"],
        [COLLECTION_NAMES.tags, "userId"],
        [COLLECTION_NAMES.itemViews, "userId"],
        [COLLECTION_NAMES.taskPlacements, "userId"],
        [COLLECTION_NAMES.syncOperations, "actorUserId"],
        [COLLECTION_NAMES.syncChanges, "recipientUserId"],
        [COLLECTION_NAMES.syncCounters, "_id"],
      ] as const)
        await (await getCollection(collection)).deleteMany({
          [field]: { $regex: `^${prefix}` },
        })
    } finally {
      await closeDatabaseConnection()
    }
  }, 30000)

  test("commits compacted peers and category atomically and replays exact effects after access is revoked", async () => {
    const actor = `${prefix}commit`
    const { item, peer, tag, operation } = await compactionFixture(actor)
    const [first, duplicate] = await Promise.all([
      executeRemoteTaskPlacementOperation(actor, operation),
      executeRemoteTaskPlacementOperation(actor, operation),
    ])
    expect(duplicate).toEqual(first)
    const effects = applied(first)
    expect(effects.sequence).toBe(1)
    expect(effects.effects).toHaveLength(3)
    const placements = await RemoteTaskPlacementRepository.open(actor)
    const views = await RemoteItemViewRepository.open(actor)
    for (const effect of effects.effects) {
      if (effect.store === "taskPlacements")
        expect(await placements.read(key(effect.record))).toEqual(effect.record)
      else if (effect.store === "itemViews")
        expect(await views.read(effect.record.itemId)).toEqual(effect.record)
      else throw new Error("Unexpected movement effect store")
    }
    expect(
      (await placements.catalog())
        .map((value) => value.position)
        .toSorted((a, b) => a - b)
    ).toEqual([-1024, 0])
    expect(
      (await placements.read(key(placement(actor, peer.id, tag.id))))?.revision
    ).toBe(2)
    expect((await views.read(item.id))?.primaryTagId).toBe(tag.id)
    expect(await (await RemoteItemRepository.open(actor)).catalog()).toEqual(
      [item, peer].toSorted((a, b) => a.id.localeCompare(b.id))
    )
    expect(await (await RemoteTagRepository.open(actor)).read(tag.id)).toEqual(
      tag
    )
    const before = await history(actor)
    expect(before.receipts).toBe(1)
    expect(before.changes).toHaveLength(1)
    expect(before.changes[0].effects).toEqual(effects)
    expect(before.counter?.sequence).toBe(1)
    const primary = await placements.read(
      key(placement(actor, item.id, tag.id))
    )
    if (!primary) throw new Error("Expected principal placement")
    expect(
      await placements.replace(1, {
        ...primary,
        revision: 2,
        position: 55,
        updatedAt: later,
      })
    ).toBe(true)
    expect(
      await (await RemoteItemRepository.open(actor)).replace(1, {
        ...item,
        revision: 2,
        updatedAt: later,
        deletedAt: later,
      })
    ).toBe(true)
    expect(
      await (await RemoteTagRepository.open(actor)).replace(1, {
        ...tag,
        revision: 2,
        updatedAt: later,
        deletedAt: later,
      })
    ).toBe(true)
    expect(await executeRemoteTaskPlacementOperation(actor, operation)).toEqual(
      first
    )
    await expect(
      executeRemoteTaskPlacementOperation(actor, {
        ...operation,
        baseRevision: 1,
      })
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
    await expect(
      executeRemoteTaskPlacementOperation(actor, {
        ...operation,
        command: { ...operation.command, tagId: null },
      })
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
    expect(await history(actor)).toEqual(before)
    expect((await placements.read(key(primary)))?.position).toBe(55)
    expect((await views.read(item.id))?.revision).toBe(1)
  }, 30000)

  test("uses placement revision as the primary CAS and advances the view independently without restoring tombstones", async () => {
    const actor = `${prefix}revisions`
    const item = await itemFixture(actor)
    const tag = await tagFixture(actor)
    const placements = await RemoteTaskPlacementRepository.open(actor)
    const views = await RemoteItemViewRepository.open(actor)
    const initial = placement(actor, item.id, null)
    expect(await placements.insert(initial)).toBe(true)
    const initialView = view(actor, item.id, null)
    expect(await views.insert(initialView)).toBe(true)
    for (let revision = 1; revision < 5; revision++)
      expect(
        await views.replace(revision, {
          ...initialView,
          revision: revision + 1,
          updatedAt: later,
        })
      ).toBe(true)
    const conflict = await executeRemoteTaskPlacementOperation(
      actor,
      move(item.id, tag.id)
    )
    expect(conflict).toMatchObject({
      kind: "preference",
      outcome: {
        status: "conflict",
        current: { store: "taskPlacements", record: initial },
      },
    })
    const result = applied(
      await executeRemoteTaskPlacementOperation(actor, move(item.id, tag.id, 1))
    )
    expect(
      result.effects.find((effect) => effect.store === "taskPlacements")?.record
        .revision
    ).toBe(2)
    expect(
      result.effects.find((effect) => effect.store === "itemViews")?.record
        .revision
    ).toBe(6)
    expect((await views.read(item.id))?.createdAt).toBe(timestamp)
    const current = await placements.read(key(initial))
    if (!current) throw new Error("Expected updated principal placement")
    const tombstone = {
      ...current,
      revision: 3,
      updatedAt: later,
      deletedAt: later,
    }
    expect(await placements.replace(2, tombstone)).toBe(true)
    expect(
      await executeRemoteTaskPlacementOperation(actor, move(item.id, null, 3))
    ).toMatchObject({
      outcome: {
        status: "conflict",
        current: { store: "taskPlacements", record: tombstone },
      },
    })
    expect(await placements.read(key(initial))).toEqual(tombstone)
    expect((await views.read(item.id))?.revision).toBe(6)
    expect((await history(actor)).counter?.sequence).toBe(1)
    expect((await history(actor)).receipts).toBe(3)
  }, 30000)

  test("does not grant access through personal records and preserves errors without journal effects", async () => {
    const actor = `${prefix}access`
    const foreignActor = `${prefix}foreign`
    const item = await itemFixture(actor)
    const foreign = await itemFixture(foreignActor)
    const tag = await tagFixture(actor)
    const foreignTag = await tagFixture(foreignActor)
    const placements = await RemoteTaskPlacementRepository.open(actor)
    const views = await RemoteItemViewRepository.open(actor)
    expect(await views.insert(view(actor, foreign.id, null))).toBe(true)
    expect(await placements.insert(placement(actor, foreign.id, null))).toBe(
      true
    )
    for (const operation of [
      move(foreign.id, null, 1),
      move(crypto.randomUUID()),
      move(item.id, null, 1),
    ])
      expect(
        (await executeRemoteTaskPlacementOperation(actor, operation)).outcome
          .status
      ).toBe("unavailable")
    for (const operation of [
      move(item.id, foreignTag.id),
      move(item.id, crypto.randomUUID()),
      {
        ...move(item.id),
        command: { ...move(item.id).command, date: "2026-10-10" },
      },
    ])
      expect(
        (await executeRemoteTaskPlacementOperation(actor, operation)).outcome
          .status
      ).toBe("invalid_command")
    expect(
      await (await RemoteTagRepository.open(actor)).replace(1, {
        ...tag,
        revision: 2,
        deletedAt: later,
        updatedAt: later,
      })
    ).toBe(true)
    expect(
      (await executeRemoteTaskPlacementOperation(actor, move(item.id, tag.id)))
        .outcome.status
    ).toBe("invalid_command")
    expect(await views.insert({ ...view(actor, item.id, null) })).toBe(true)
    expect(
      await views.replace(1, {
        ...view(actor, item.id, null),
        revision: 2,
        deletedAt: later,
        updatedAt: later,
      })
    ).toBe(true)
    expect(
      (await executeRemoteTaskPlacementOperation(actor, move(item.id))).outcome
        .status
    ).toBe("invalid_command")
    expect(
      await (await RemoteItemRepository.open(actor)).replace(1, {
        ...item,
        revision: 2,
        deletedAt: later,
        updatedAt: later,
      })
    ).toBe(true)
    expect(
      (await executeRemoteTaskPlacementOperation(actor, move(item.id))).outcome
        .status
    ).toBe("unavailable")
    expect(await placements.catalog()).toEqual([
      placement(actor, foreign.id, null),
    ])
    const stored = await history(actor)
    expect(stored.receipts).toBe(9)
    expect(stored.counter).toBeNull()
    expect(stored.changes).toEqual([])
  }, 30000)

  test("stores unsupported occurrence, event, birthday and series intentions without placements or views", async () => {
    const actor = `${prefix}unsupported`
    const item = await itemFixture(actor)
    const event = await itemFixture(actor, {
      kind: "event",
      title: "Event",
      description: "",
      schedule: {
        mode: "all_day",
        startDate: "2026-10-09",
        endDateExclusive: "2026-10-10",
      },
      recurrence: null,
    })
    const birthday = await itemFixture(actor, {
      kind: "birthday",
      title: "Birthday",
      description: "",
      month: 10,
      day: 9,
      birthYear: null,
      timeZone: "Europe/Madrid",
    })
    const series = await itemFixture(actor, {
      ...task,
      recurrence: {
        frequency: "daily",
        interval: 1,
        anchorDate: "2026-10-09",
        timeZone: "Europe/Madrid",
        end: { type: "never" },
      },
    })
    const occurrence = move(item.id)
    occurrence.command.occurrenceId = `${item.id}:2026-10-09`
    for (const operation of [
      occurrence,
      move(event.id),
      move(birthday.id),
      move(series.id),
    ]) {
      const result = await executeRemoteTaskPlacementOperation(actor, operation)
      expect(result.outcome.status).toBe("unsupported")
      expect(
        (await readRemoteOperationReceipt(actor, operation.operationId))?.result
      ).toEqual(result)
      expect(
        await executeRemoteTaskPlacementOperation(actor, operation)
      ).toEqual(result)
    }
    expect(
      await (await RemoteTaskPlacementRepository.open(actor)).catalog()
    ).toEqual([])
    expect(
      await (await RemoteItemViewRepository.open(actor)).catalog()
    ).toEqual([])
    expect(await history(actor)).toEqual({
      receipts: 4,
      changes: [],
      counter: null,
    })
    await expect(
      executeRemoteTaskPlacementOperation(actor, { ...occurrence, extra: true })
    ).rejects.toThrow()
  }, 30000)

  test("rolls back all compacted placements, view, journal, receipt and sequence after a late failure", async () => {
    const actor = `${prefix}rollback`
    const { item, peerView, peerPlacement, operation } =
      await compactionFixture(actor)
    const database = await ownedDatabase()
    await database.client.withSession(async (session) => {
      await expect(
        stageRemoteTaskPlacementOperation(actor, operation, timestamp, session)
      ).rejects.toThrow("active transaction")
      await expect(
        session.withTransaction(async () => {
          const result = await stageRemoteTaskPlacementOperation(
            actor,
            operation,
            timestamp,
            session
          )
          expect(applied(result).effects).toHaveLength(3)
          expect(
            await (
              await RemoteTaskPlacementRepository.open(actor, session)
            ).catalog()
          ).toHaveLength(2)
          expect(
            (
              await (
                await RemoteItemViewRepository.open(actor, session)
              ).read(item.id)
            )?.primaryTagId
          ).toBe(peerView.primaryTagId)
          expect(
            (
              await readRemoteOperationReceipt(
                actor,
                operation.operationId,
                session
              )
            )?.result
          ).toEqual(result)
          expect(
            await readRemoteOperationReceipt(actor, operation.operationId)
          ).toBeNull()
          expect(
            await (await RemoteTaskPlacementRepository.open(actor)).catalog()
          ).toEqual([peerPlacement])
          expect(
            await (await RemoteItemViewRepository.open(actor)).catalog()
          ).toEqual([peerView])
          throw new Error("Intentional failure after movement receipt")
        })
      ).rejects.toThrow("Intentional failure after movement receipt")
    })
    expect(
      await (await RemoteTaskPlacementRepository.open(actor)).catalog()
    ).toEqual([peerPlacement])
    expect(
      await (await RemoteItemViewRepository.open(actor)).catalog()
    ).toEqual([peerView])
    expect(await history(actor)).toEqual({
      receipts: 0,
      changes: [],
      counter: null,
    })
    expect(
      applied(await executeRemoteTaskPlacementOperation(actor, operation))
        .sequence
    ).toBe(1)
    expect((await history(actor)).receipts).toBe(1)
  }, 30000)

  test("validates unrelated records in every catalog before writing and bypasses later corruption only for exact replay", async () => {
    const actor = `${prefix}corruption`
    const item = await itemFixture(actor)
    const peer = await itemFixture(actor)
    const tag = await tagFixture(actor)
    const peerView = view(actor, peer.id, tag.id)
    const peerPlacement = placement(actor, peer.id, tag.id)
    expect(
      await (await RemoteItemViewRepository.open(actor)).insert(peerView)
    ).toBe(true)
    expect(
      await (await RemoteTaskPlacementRepository.open(actor)).insert(
        peerPlacement
      )
    ).toBe(true)
    const operation = move(item.id)
    for (const [name, identity] of [
      [COLLECTION_NAMES.items, { id: peer.id }],
      [COLLECTION_NAMES.tags, { id: tag.id }],
      [COLLECTION_NAMES.itemViews, { itemId: peer.id }],
      [COLLECTION_NAMES.taskPlacements, { occurrenceId: peer.id }],
    ] as const) {
      const collection = await getCollection(name)
      await collection.updateOne(identity, { $set: { revision: 0 } })
      try {
        await expect(
          executeRemoteTaskPlacementOperation(actor, operation)
        ).rejects.toThrow()
        expect(
          await readRemoteOperationReceipt(actor, operation.operationId)
        ).toBeNull()
        expect(await history(actor)).toEqual({
          receipts: 0,
          changes: [],
          counter: null,
        })
      } finally {
        await collection.updateOne(identity, { $set: { revision: 1 } })
      }
    }
    const committed = await executeRemoteTaskPlacementOperation(
      actor,
      operation
    )
    const before = await history(actor)
    const collection = await getCollection(COLLECTION_NAMES.tags)
    await collection.updateOne(
      { userId: actor, id: tag.id },
      { $set: { revision: 0 } }
    )
    try {
      expect(
        await executeRemoteTaskPlacementOperation(actor, operation)
      ).toEqual(committed)
      await expect(
        executeRemoteTaskPlacementOperation(actor, move(item.id, null, 1))
      ).rejects.toThrow()
      expect(await history(actor)).toEqual(before)
    } finally {
      await collection.updateOne(
        { userId: actor, id: tag.id },
        { $set: { revision: 1 } }
      )
    }
  }, 30000)

  test("serializes competing primary CAS operations without duplicate sequence or lost effects", async () => {
    const actor = `${prefix}race`
    const item = await itemFixture(actor)
    const tag = await tagFixture(actor)
    const placements = await RemoteTaskPlacementRepository.open(actor)
    const initial = placement(actor, item.id, null)
    expect(await placements.insert(initial)).toBe(true)
    expect(
      await (await RemoteItemViewRepository.open(actor)).insert(
        view(actor, item.id, null)
      )
    ).toBe(true)
    const results = await Promise.all([
      executeRemoteTaskPlacementOperation(actor, move(item.id, tag.id, 1)),
      executeRemoteTaskPlacementOperation(actor, move(item.id, null, 1)),
    ])
    expect(results.map((result) => result.outcome.status).toSorted()).toEqual([
      "applied",
      "conflict",
    ])
    const winner = results.find((result) => result.outcome.status === "applied")
    if (!winner) throw new Error("Expected one committed movement")
    for (const effect of applied(winner).effects)
      if (effect.store === "taskPlacements")
        expect(await placements.read(key(effect.record))).toEqual(effect.record)
      else if (effect.store === "itemViews")
        expect(
          await (await RemoteItemViewRepository.open(actor)).read(item.id)
        ).toEqual(effect.record)
    expect((await placements.read(key(initial)))?.revision).toBe(2)
    const stored = await history(actor)
    expect(stored.receipts).toBe(2)
    expect(stored.changes).toHaveLength(1)
    expect(stored.counter?.sequence).toBe(1)
  }, 30000)

  test("uses the declared overdue day and one supplied snapshot for later catalog reads", async () => {
    const actor = `${prefix}snapshot`
    const item = await itemFixture(actor)
    const tag = await tagFixture(actor)
    const operation = move(item.id, tag.id)
    operation.command.scope = "overdue"
    operation.command.date = "2026-10-10"
    const database = await ownedDatabase()
    await database.client.withSession((session) =>
      session.withTransaction(
        async () => {
          expect(
            await (await RemoteItemRepository.open(actor, session)).catalog()
          ).toEqual([item])
          expect(
            await (await RemoteTagRepository.open(actor)).replace(1, {
              ...tag,
              revision: 2,
              updatedAt: later,
              deletedAt: later,
            })
          ).toBe(true)
          const result = await stageRemoteTaskPlacementOperation(
            actor,
            operation,
            later,
            session
          )
          const effects = applied(result)
          const moved = effects.effects.find(
            (effect) => effect.store === "taskPlacements"
          )
          expect(moved?.record).toMatchObject({
            scope: "overdue",
            date: overduePlacementDate,
            updatedAt: later,
          })
          expect(
            await (await RemoteTagRepository.open(actor, session)).catalog()
          ).toEqual([tag])
        },
        { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } }
      )
    )
    expect(
      (await (await RemoteTaskPlacementRepository.open(actor)).catalog())[0]
        ?.date
    ).toBe(overduePlacementDate)
    expect(
      (await (await RemoteTagRepository.open(actor)).read(tag.id))?.deletedAt
    ).toBe(later)
    expect((await history(actor)).counter?.sequence).toBe(1)
    expect(operation.command.date).toBe("2026-10-10")
  }, 30000)
})
