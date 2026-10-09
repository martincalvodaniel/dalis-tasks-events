import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { applyItemCommand } from "@/lib/calendar/item-command"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { readRemoteChangesV2 } from "@/lib/db/remote-changes-v2"
import { RemoteItemViewRepository } from "@/lib/db/remote-item-views"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { executeRemoteOperationV2 } from "@/lib/db/remote-operation-commands"
import { executeRemoteOperationV3 } from "@/lib/db/remote-operation-commands-v3"
import { readRemoteOperationReceipt } from "@/lib/db/remote-operation-receipts"
import { RemoteTagRepository } from "@/lib/db/remote-tags"
import { RemoteTaskPlacementRepository } from "@/lib/db/remote-task-placements"
import { syncOperationFingerprint } from "@/lib/sync/operation-fingerprint"
import { OperationIdentityReuseError } from "@/lib/sync/operation-identity-reuse"
import type { CalendarItemDraft } from "@/types/calendar-item"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"
import type { SyncCommand } from "@/types/sync"

const config = getSyncDatabaseTestConfig()
const prefix = `dispatcher-v3-${config?.runId}-`
const timestamp = "2026-10-09T00:00:00.000Z"
const task: CalendarItemDraft = {
  kind: "task",
  title: "Owned transition task",
  description: "Preserved content",
  scheduledDate: "2026-10-09",
  status: "not_started",
  checklist: [],
  recurrence: null,
}
function operation(command: SyncCommand, baseRevision = 0) {
  return {
    operationId: crypto.randomUUID(),
    protocolVersion: 1 as const,
    baseRevision,
    command,
  }
}
function move(itemId: string, tagId: string | null = null) {
  return operation({
    type: "task.move",
    itemId,
    occurrenceId: null,
    scope: "day",
    date: "2026-10-09",
    tagId,
    beforeId: null,
    afterId: null,
  })
}
async function itemFixture(actor: string, input = task) {
  const item = applyItemCommand(
    null,
    { type: "item.create", itemId: crypto.randomUUID(), input },
    actor,
    timestamp
  )
  item.revision = 1
  expect(await (await RemoteItemRepository.open(actor)).insert(item)).toBe(true)
  return item
}
async function tagFixture(actor: string, name: string) {
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
async function ownedDatabase() {
  if (!config) throw new Error("Sync test configuration is required")
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Dispatcher database does not match its isolated run")
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
    throw new Error("Expected committed preference effects")
  return result.outcome.effects
}
async function personal(actor: string) {
  return {
    placements: await (
      await RemoteTaskPlacementRepository.open(actor)
    ).catalog(),
    views: await (await RemoteItemViewRepository.open(actor)).catalog(),
  }
}

describe.skipIf(!config)(
  "prepared generation-three operation dispatcher",
  () => {
    beforeAll(async () => {
      const database = await ownedDatabase()
      const staged = INDEX_SPECS.filter(
        (spec) =>
          spec.collection === COLLECTION_NAMES.tags ||
          spec.collection === COLLECTION_NAMES.itemViews ||
          spec.collection === COLLECTION_NAMES.taskPlacements
      )
      expect(staged).toHaveLength(4)
      expect(staged.every((spec) => spec.provisioning === "explicit")).toBe(
        true
      )
      await ensureIndexes(database, staged)
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

    test("applies an unchanged previously unsupported move once and journals complete independent follow-up effects", async () => {
      const actor = `${prefix}historical`
      const item = await itemFixture(actor),
        peer = await itemFixture(actor)
      const category = await tagFixture(actor, "Work"),
        destination = await tagFixture(actor, "Home")
      const peerPlacement = {
        userId: actor,
        occurrenceId: peer.id,
        scope: "day" as const,
        date: "2026-10-09",
        tagId: category.id,
        position: 1e12,
        revision: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      }
      expect(
        await (await RemoteTaskPlacementRepository.open(actor)).insert(
          peerPlacement
        )
      ).toBe(true)
      expect(
        await (await RemoteItemViewRepository.open(actor)).insert({
          userId: actor,
          itemId: peer.id,
          primaryTagId: category.id,
          revision: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
        })
      ).toBe(true)
      const historical = move(item.id, category.id)
      if (historical.command.type !== "task.move")
        throw new Error("Expected move intention")
      historical.command.afterId = peer.id
      const original = structuredClone(historical)
      const before = await history(actor),
        localBefore = await personal(actor)
      expect(await executeRemoteOperationV2(actor, historical)).toEqual({
        kind: "preference",
        outcome: { operationId: historical.operationId, status: "unsupported" },
      })
      expect(
        await readRemoteOperationReceipt(actor, historical.operationId)
      ).toBeNull()
      expect(await history(actor)).toEqual(before)
      expect(await personal(actor)).toEqual(localBefore)
      const first = await executeRemoteOperationV3(actor, historical)
      const effects = applied(first)
      expect(effects.effects).toHaveLength(3)
      expect(effects.sequence).toBe(1)
      expect(
        effects.effects
          .filter((effect) => effect.store === "taskPlacements")
          .map((effect) => effect.record.revision)
          .toSorted()
      ).toEqual([1, 2])
      expect(
        effects.effects.find((effect) => effect.store === "itemViews")?.record
          .revision
      ).toBe(1)
      const receipt = await readRemoteOperationReceipt(
        actor,
        historical.operationId
      )
      expect(receipt?.fingerprint).toBe(syncOperationFingerprint(original))
      expect(receipt?.result).toEqual(first)
      const committed = await history(actor),
        projected = await personal(actor)
      expect(committed.receipts).toBe(1)
      expect(committed.changes).toHaveLength(1)
      expect(committed.counter?.sequence).toBe(1)
      // A lost response resubmits the original intention, without regenerating its identity or payload.
      expect(await executeRemoteOperationV3(actor, historical)).toEqual(first)
      expect(await history(actor)).toEqual(committed)
      expect(await personal(actor)).toEqual(projected)
      expect(historical).toEqual(original)
      const categoryUpdate = operation(
        {
          type: "tag.save",
          tagId: category.id,
          input: { name: "Work updated", color: "#654321", position: 1024 },
        },
        1
      )
      const viewUpdate = operation(
        {
          type: "item-view.set",
          itemId: item.id,
          primaryTagId: destination.id,
        },
        1
      )
      const changedCategory = await executeRemoteOperationV3(
        actor,
        categoryUpdate
      )
      const changedView = await executeRemoteOperationV3(actor, viewUpdate)
      expect(applied(changedCategory).effects[0].record.revision).toBe(2)
      expect(applied(changedView).effects[0].record.revision).toBe(2)
      expect(
        (
          await (
            await RemoteTaskPlacementRepository.open(actor)
          ).read({ occurrenceId: item.id, scope: "day", date: "2026-10-09" })
        )?.revision
      ).toBe(1)
      const page = await readRemoteChangesV2(actor, {
        after: 0,
        through: null,
        limit: 50,
      })
      expect(page.through).toBe(3)
      expect(page.nextAfter).toBe(3)
      expect(page.hasMore).toBe(false)
      expect(page.changes.map((entry) => entry.operationId)).toEqual([
        historical.operationId,
        categoryUpdate.operationId,
        viewUpdate.operationId,
      ])
      for (const [index, result] of [
        first,
        changedCategory,
        changedView,
      ].entries()) {
        const change = page.changes[index]
        if (change.kind !== "preference")
          throw new Error("Expected preference journal entry")
        expect(change.effects).toEqual(applied(result))
      }
      expect((await history(actor)).receipts).toBe(3)
      expect((await history(actor)).counter?.sequence).toBe(3)
      expect(await (await RemoteItemRepository.open(actor)).catalog()).toEqual(
        [item, peer].toSorted((a, b) => a.id.localeCompare(b.id))
      )
    }, 30000)

    test("isolates foreign actors and rejects identity reuse while replay survives deleted source records", async () => {
      const actor = `${prefix}ownership`,
        foreign = `${prefix}foreign`
      const item = await itemFixture(actor),
        category = await tagFixture(actor, "Owned")
      const historical = move(item.id, category.id)
      const first = await executeRemoteOperationV3(actor, historical)
      applied(first)
      const before = await history(actor),
        projected = await personal(actor)
      const denied = await executeRemoteOperationV3(foreign, historical)
      expect(denied.kind).toBe("preference")
      expect(denied.outcome.status).toBe("unavailable")
      expect(await personal(foreign)).toEqual({ placements: [], views: [] })
      expect((await history(foreign)).changes).toHaveLength(0)
      expect((await history(foreign)).counter).toBeNull()
      expect(await history(actor)).toEqual(before)
      expect(await personal(actor)).toEqual(projected)
      if (historical.command.type !== "task.move")
        throw new Error("Expected move intention")
      await expect(
        executeRemoteOperationV3(actor, {
          ...historical,
          command: { ...historical.command, tagId: null },
        })
      ).rejects.toThrow(OperationIdentityReuseError)
      expect(await history(actor)).toEqual(before)
      expect(await personal(actor)).toEqual(projected)
      const deletion = await executeRemoteOperationV3(
        actor,
        operation({ type: "item.delete", itemId: item.id }, 1)
      )
      expect(deletion.kind).toBe("item")
      expect(deletion.outcome.status).toBe("applied")
      applied(
        await executeRemoteOperationV3(
          actor,
          operation({ type: "tag.delete", tagId: category.id }, 1)
        )
      )
      expect(
        (await (await RemoteItemRepository.open(actor)).read(item.id))
          ?.deletedAt
      ).not.toBeNull()
      expect(
        (await (await RemoteTagRepository.open(actor)).read(category.id))
          ?.deletedAt
      ).not.toBeNull()
      const deletedHistory = await history(actor),
        deletedProjection = await personal(actor)
      expect(await executeRemoteOperationV3(actor, historical)).toEqual(first)
      expect(await history(actor)).toEqual(deletedHistory)
      expect(await personal(actor)).toEqual(deletedProjection)
    }, 30000)

    test("retains v2 family fallback and leaves occurrences, events and recurring tasks unsupported", async () => {
      const actor = `${prefix}fallback`
      const itemId = crypto.randomUUID(),
        tagId = crypto.randomUUID()
      const fallbacks = [
        operation({ type: "item.create", itemId, input: task }),
        operation({
          type: "tag.save",
          tagId,
          input: { name: "Fallback", color: "#123456", position: 0 },
        }),
        operation({ type: "item-view.set", itemId, primaryTagId: tagId }),
      ]
      for (const next of fallbacks) {
        const result = await executeRemoteOperationV3(actor, next)
        expect(result.outcome.status).toBe("applied")
        expect(await executeRemoteOperationV2(actor, next)).toEqual(result)
        expect(
          (await readRemoteOperationReceipt(actor, next.operationId))?.result
        ).toEqual(result)
      }
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
      const occurrence = move(itemId)
      if (occurrence.command.type !== "task.move")
        throw new Error("Expected move intention")
      occurrence.command.occurrenceId = `${itemId}:2026-10-09`
      const before = await history(actor),
        projected = await personal(actor)
      for (const next of [occurrence, move(event.id), move(series.id)]) {
        const result = await executeRemoteOperationV3(actor, next)
        expect(result).toEqual({
          kind: "preference",
          outcome: { operationId: next.operationId, status: "unsupported" },
        })
        expect(
          (await readRemoteOperationReceipt(actor, next.operationId))?.result
        ).toEqual(result)
        expect(await executeRemoteOperationV3(actor, next)).toEqual(result)
      }
      expect(await personal(actor)).toEqual(projected)
      const unsupported = await history(actor)
      expect(unsupported.receipts).toBe(before.receipts + 3)
      expect(unsupported.changes).toEqual(before.changes)
      expect(unsupported.counter).toEqual(before.counter)
      await expect(executeRemoteOperationV3("", fallbacks[0])).rejects.toThrow()
      await expect(
        executeRemoteOperationV3(actor, { ...occurrence, protocolVersion: 2 })
      ).rejects.toThrow()
      expect(await history(actor)).toEqual(unsupported)
    }, 30000)
  }
)
