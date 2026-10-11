import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { executeRemoteRecurringPlanOperation } from "@/lib/db/remote-item-commands"
import { RemoteItemViewRepository } from "@/lib/db/remote-item-views"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { executeRemotePlanOccurrenceOperation } from "@/lib/db/remote-plan-occurrence-commands"
import { RemotePlanOccurrenceRepository } from "@/lib/db/remote-plan-occurrences"
import { executeRemoteRecurringTagOperation } from "@/lib/db/remote-tag-commands"
import {
  executeRemotePlanTaskPlacementOperation,
  executeRemoteRecurringTaskPlacementOperation,
  stageRemoteRecurringTaskPlacementOperation,
} from "@/lib/db/remote-task-placement-commands"
import { RemoteTaskPlacementRepository } from "@/lib/db/remote-task-placements"
import { OperationIdentityReuseError } from "@/lib/sync/operation-identity-reuse"
import type { PlanDraft, PlanVariant } from "@/types/plan-item"
import type { SyncCommand, SyncOperation } from "@/types/sync"

const config = getSyncDatabaseTestConfig()
const prefix = `recurring-placement-${config?.runId}-`
const now = "2026-10-11T09:00:00.000Z"
const date = "2026-10-11"
function operation(command: SyncCommand, baseRevision = 0): SyncOperation {
  return {
    operationId: crypto.randomUUID(),
    protocolVersion: 1,
    baseRevision,
    command,
  }
}
function draft(variant: PlanVariant = "task", recurring = true): PlanDraft {
  return {
    kind: "plan",
    variant,
    title: "Own plan",
    description: "Preserved content",
    status: "not_started",
    checklist: [],
    schedule: {
      mode: "all_day",
      startDate: date,
      endDateExclusive: "2026-10-12",
    },
    recurrence: recurring
      ? {
          frequency: "daily",
          interval: 1,
          anchorDate: date,
          timeZone: "Europe/Madrid",
          end: { type: "never" },
        }
      : null,
  }
}
async function seed(actor: string, input = draft()) {
  const itemId = crypto.randomUUID()
  expect(
    (
      await executeRemoteRecurringPlanOperation(
        actor,
        operation({ type: "item.create", itemId, input })
      )
    ).status
  ).toBe("applied")
  return itemId
}
function move(
  itemId: string,
  occurrenceId: string | null = `${itemId}:${date}`
) {
  return operation({
    type: "task.move",
    itemId,
    occurrenceId,
    scope: "day",
    date,
    tagId: null,
    beforeId: null,
    afterId: null,
  })
}
async function snapshot(actor: string) {
  return {
    items: await (await RemoteItemRepository.open(actor)).catalog(),
    occurrences: await (
      await RemotePlanOccurrenceRepository.open(actor)
    ).catalog(),
    views: await (await RemoteItemViewRepository.open(actor)).catalog(),
    placements: await (
      await RemoteTaskPlacementRepository.open(actor)
    ).catalog(),
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
    guards: await (await getCollection(COLLECTION_NAMES.planSeriesGuards))
      .find({ userId: actor })
      .sort({ _id: 1 })
      .toArray(),
  }
}
async function ownedDatabase() {
  if (!config) throw new Error("Sync test configuration is required")
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Recurring placement tests require their owned database")
  return database
}
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe.skipIf(!config)("prepared atomic recurring mixed placements", () => {
  beforeAll(async () => {
    await ensureIndexes(
      await ownedDatabase(),
      INDEX_SPECS.filter((spec) =>
        [
          COLLECTION_NAMES.tags,
          COLLECTION_NAMES.itemViews,
          COLLECTION_NAMES.taskPlacements,
          COLLECTION_NAMES.planOccurrences,
        ].some((name) => name === spec.collection)
      )
    )
  }, 30000)
  afterAll(async () => {
    try {
      await ownedDatabase()
      for (const [name, key] of [
        [COLLECTION_NAMES.items, "ownerId"],
        [COLLECTION_NAMES.itemViews, "userId"],
        [COLLECTION_NAMES.tags, "userId"],
        [COLLECTION_NAMES.taskPlacements, "userId"],
        [COLLECTION_NAMES.planOccurrences, "userId"],
        [COLLECTION_NAMES.planSeriesGuards, "userId"],
        [COLLECTION_NAMES.syncOperations, "actorUserId"],
        [COLLECTION_NAMES.syncChanges, "recipientUserId"],
        [COLLECTION_NAMES.syncCounters, "_id"],
      ] as const)
        await (await getCollection(name)).deleteMany({
          [key]: { $regex: `^${prefix}` },
        })
    } finally {
      await closeDatabaseConnection()
    }
  }, 30000)

  test("all variants mix generated or materialized timed appearances with simple peers and replay once", async () => {
    for (const variant of ["task", "event", "appointment", "note"] as const) {
      const actor = `${prefix}${variant}`
      const input = draft(variant)
      if (variant === "appointment")
        input.schedule = {
          mode: "timed",
          localStart: `${date}T09:00`,
          localEnd: `${date}T09:30`,
          timeZone: "Europe/Madrid",
        }
      const itemId = await seed(actor, input)
      const slot = input.schedule.mode === "timed" ? `${date}T09:00` : date
      const occurrenceId = `${itemId}:${slot}`
      if (variant === "note")
        expect(
          (
            await executeRemotePlanOccurrenceOperation(
              actor,
              operation(
                {
                  type: "plan.set-occurrence-status",
                  itemId,
                  occurrenceId,
                  expectedOccurrenceRevision: 0,
                  status: "in_progress",
                },
                1
              )
            )
          ).outcome.status
        ).toBe("applied")
      const peer = await seed(actor, draft("task", false))
      const requested = move(itemId, occurrenceId)
      if (requested.command.type !== "task.move")
        throw new Error("Expected movement")
      requested.command.beforeId = peer
      const payload = JSON.stringify(requested)
      const before = await snapshot(actor)
      const [left, right] = await Promise.all([
        executeRemoteRecurringTaskPlacementOperation(actor, requested),
        executeRemoteRecurringTaskPlacementOperation(actor, requested),
      ])
      expect(left).toEqual(right)
      expect(left.outcome.status).toBe("applied")
      const after = await snapshot(actor)
      expect(after.placements).toHaveLength(2)
      expect(after.items).toEqual(before.items)
      expect(after.occurrences).toEqual(before.occurrences)
      expect(after.receipts).toHaveLength(before.receipts.length + 1)
      expect(after.changes).toHaveLength(before.changes.length + 1)
      expect(after.counter?.sequence).toBe((before.counter?.sequence ?? 0) + 1)
      expect(
        after.guards.every(
          (guard, index) => guard.token !== before.guards[index].token
        )
      ).toBe(true)
      expect(
        await executeRemoteRecurringTaskPlacementOperation(actor, requested)
      ).toEqual(left)
      expect(await snapshot(actor)).toEqual(after)
      expect(JSON.stringify(requested)).toBe(payload)
    }
  }, 30000)

  test("position CAS has one winner and historical unsupported or cross-family identity remains exact", async () => {
    const actor = `${prefix}cas`
    const itemId = await seed(actor)
    const historical = move(itemId)
    const rejected = await executeRemotePlanTaskPlacementOperation(
      actor,
      historical
    )
    expect(rejected.outcome.status).toBe("unsupported")
    const before = await snapshot(actor)
    expect(
      await executeRemoteRecurringTaskPlacementOperation(actor, historical)
    ).toEqual(rejected)
    expect(await snapshot(actor)).toEqual(before)
    const [left, right] = await Promise.all([
      executeRemoteRecurringTaskPlacementOperation(actor, move(itemId)),
      executeRemoteRecurringTaskPlacementOperation(actor, move(itemId)),
    ])
    expect([left.outcome.status, right.outcome.status].toSorted()).toEqual([
      "applied",
      "conflict",
    ])
    expect((await snapshot(actor)).placements[0].revision).toBe(1)
    const occurrenceOperation = operation(
      {
        type: "plan.set-occurrence-status",
        itemId,
        occurrenceId: `${itemId}:${date}`,
        expectedOccurrenceRevision: 0,
        status: "in_progress",
      },
      1
    )
    await executeRemotePlanOccurrenceOperation(actor, occurrenceOperation)
    const frozen = await snapshot(actor)
    await expect(
      executeRemoteRecurringTaskPlacementOperation(actor, {
        ...move(itemId),
        operationId: occurrenceOperation.operationId,
      })
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
    expect(await snapshot(actor)).toEqual(frozen)
    const tagId = crypto.randomUUID()
    const tag = operation({
      type: "tag.save",
      tagId,
      input: { name: "Owned", color: "#123456", position: 0 },
    })
    await executeRemoteRecurringTagOperation(actor, tag)
    await expect(
      executeRemoteRecurringTaskPlacementOperation(actor, {
        ...move(itemId),
        operationId: tag.operationId,
      })
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
  }, 30000)

  test("late failure rolls back every peer, view, guard, receipt and journal before clean retry", async () => {
    const actor = `${prefix}rollback`
    const itemId = await seed(actor)
    const peer = await seed(actor, draft("event", false))
    const requested = move(itemId)
    if (requested.command.type !== "task.move")
      throw new Error("Expected movement")
    requested.command.beforeId = peer
    const before = await snapshot(actor)
    const database = await ownedDatabase()
    await expect(
      database.client.withSession((session) =>
        session.withTransaction(async () => {
          const staged = await stageRemoteRecurringTaskPlacementOperation(
            actor,
            requested,
            now,
            session
          )
          expect(staged.outcome.status).toBe("applied")
          throw new Error("Rollback after recurring receipt")
        })
      )
    ).rejects.toThrow("Rollback after recurring receipt")
    expect(await snapshot(actor)).toEqual(before)
    expect(
      (await executeRemoteRecurringTaskPlacementOperation(actor, requested))
        .outcome.status
    ).toBe("applied")
    expect((await snapshot(actor)).receipts).toHaveLength(
      before.receipts.length + 1
    )
  }, 30000)

  test("a guarded parent edit or deletion after the movement snapshot forces full reread", async () => {
    for (const deleted of [false, true]) {
      const actor = `${prefix}race-${deleted}`
      const itemId = await seed(actor)
      const paused = deferred(),
        release = deferred()
      const original = RemoteItemRepository.prototype.catalog
      let reads = 0
      RemoteItemRepository.prototype.catalog = async function () {
        const records = await original.call(this)
        if (records.some((item) => item.id === itemId) && ++reads === 1) {
          paused.resolve()
          await release.promise
        }
        return records
      }
      const pending = executeRemoteRecurringTaskPlacementOperation(
        actor,
        move(itemId)
      )
      try {
        await paused.promise
        const command: SyncCommand = deleted
          ? { type: "item.delete", itemId }
          : {
              type: "item.update",
              itemId,
              input: { ...draft(), title: "Concurrent title" },
            }
        expect(
          (
            await executeRemoteRecurringPlanOperation(
              actor,
              operation(command, 1)
            )
          ).status
        ).toBe("applied")
        release.resolve()
        const result = await pending
        expect(result.outcome.status).toBe(deleted ? "unavailable" : "applied")
        expect(reads).toBeGreaterThanOrEqual(2)
        const after = await snapshot(actor)
        expect(after.placements).toHaveLength(deleted ? 0 : 1)
        expect(after.items[0]).toMatchObject({
          revision: 2,
          ...(deleted
            ? { deletedAt: expect.any(String) }
            : { title: "Concurrent title" }),
        })
      } finally {
        release.resolve()
        await pending.catch(() => {})
        RemoteItemRepository.prototype.catalog = original
      }
    }
  }, 30000)
})
