import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import type { Document } from "mongodb"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { executeRemoteOperationV4 } from "@/lib/db/remote-operation-commands-v4"
import { executeRemoteRecurringOperation } from "@/lib/db/remote-recurring-operation-commands"
import { syncOperationFingerprint } from "@/lib/sync/operation-fingerprint"
import { OperationIdentityReuseError } from "@/lib/sync/operation-identity-reuse"
import { validateRemoteRecurringPushResult } from "@/lib/sync/remote-recurring-push"
import type { PlanDraft } from "@/types/plan-item"
import type { SyncCommand, SyncOperation } from "@/types/sync"

const config = getSyncDatabaseTestConfig()
const prefix = `recurring-dispatch-${config?.runId}-`
function operation(command: SyncCommand, baseRevision = 0): SyncOperation {
  return {
    operationId: crypto.randomUUID(),
    protocolVersion: 1,
    baseRevision,
    command,
  }
}
function draft(): PlanDraft {
  return {
    kind: "plan",
    variant: "appointment",
    title: "Recurring dispatcher fixture",
    description: "",
    status: "not_started",
    checklist: [
      { id: crypto.randomUUID(), text: "Own step", completed: false },
    ],
    schedule: {
      mode: "all_day",
      startDate: "2026-10-11",
      endDateExclusive: "2026-10-12",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-11",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
  }
}
async function ownedDatabase() {
  if (!config) throw new Error("Sync test configuration is required")
  const db = await getDatabase()
  if (db.databaseName !== config.mongodbDatabase)
    throw new Error("Recurring dispatcher requires its owned database")
  return db
}
async function snapshot(actor: string) {
  return Promise.all([
    ...(
      [
        [COLLECTION_NAMES.items, "ownerId"],
        [COLLECTION_NAMES.tags, "userId"],
        [COLLECTION_NAMES.itemViews, "userId"],
        [COLLECTION_NAMES.taskPlacements, "userId"],
        [COLLECTION_NAMES.planOccurrences, "userId"],
        [COLLECTION_NAMES.planSeriesGuards, "userId"],
        [COLLECTION_NAMES.syncOperations, "actorUserId"],
        [COLLECTION_NAMES.syncChanges, "recipientUserId"],
      ] as const
    ).map(async ([name, key]) =>
      (await getCollection(name))
        .find({ [key]: actor })
        .sort({ _id: 1 })
        .toArray()
    ),
    (
      await getCollection<Document & { _id: string }>(
        COLLECTION_NAMES.syncCounters
      )
    )
      .find({ _id: actor })
      .toArray(),
  ])
}

describe.skipIf(!config)("prepared recurring command dispatcher", () => {
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
        [COLLECTION_NAMES.tags, "userId"],
        [COLLECTION_NAMES.itemViews, "userId"],
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

  test("dispatches all recurring families and replays complete results with one durable receipt each", async () => {
    const actor = `${prefix}families`,
      itemId = crypto.randomUUID(),
      tagId = crypto.randomUUID(),
      input = draft()
    const slot = `${itemId}:2026-10-11`
    const operations = [
      operation({ type: "item.create", itemId, input }),
      operation({
        type: "tag.save",
        tagId,
        input: { name: "Own", color: "#123456", position: 0 },
      }),
      operation({ type: "item-view.set", itemId, primaryTagId: tagId }),
      operation({
        type: "task.move",
        itemId,
        occurrenceId: slot,
        scope: "day",
        date: "2026-10-11",
        tagId,
        beforeId: null,
        afterId: null,
      }),
      operation(
        {
          type: "plan.set-occurrence-status",
          itemId,
          occurrenceId: slot,
          expectedOccurrenceRevision: 0,
          status: "in_progress",
        },
        1
      ),
      operation(
        {
          type: "plan.set-occurrence-checklist-entry",
          itemId,
          occurrenceId: slot,
          expectedOccurrenceRevision: 1,
          entryId: input.checklist[0].id,
          completed: true,
        },
        1
      ),
      operation(
        {
          type: "plan.update-occurrence",
          itemId,
          occurrenceId: slot,
          expectedOccurrenceRevision: 2,
          input: {
            title: "Edited appearance",
            description: "Own content",
            checklist: input.checklist.map(({ id, text }) => ({ id, text })),
            schedule: {
              mode: "all_day",
              startDate: "2026-10-12",
              endDateExclusive: "2026-10-13",
            },
          },
        },
        1
      ),
      operation(
        {
          type: "plan.cancel-occurrence",
          itemId,
          occurrenceId: slot,
          expectedOccurrenceRevision: 3,
        },
        1
      ),
      operation(
        {
          type: "item.update",
          itemId,
          input: { ...input, title: "Edited root" },
        },
        1
      ),
      operation({ type: "tag.move", tagId, beforeId: null, afterId: null }, 1),
      operation({ type: "item.delete", itemId }, 2),
      operation({ type: "tag.delete", tagId }, 2),
    ]
    const results = []
    for (const next of operations) {
      const result = await executeRemoteRecurringOperation(actor, next)
      expect(result.outcome.status).toBe("applied")
      results.push(result)
    }
    const response = {
      transportVersion: 2 as const,
      status: "complete" as const,
      results,
    }
    expect(
      validateRemoteRecurringPushResult(response, actor, {
        transportVersion: 2,
        expectedUserId: actor,
        operations,
      })
    ).toEqual(response)
    const before = await snapshot(actor)
    for (const [index, next] of operations.entries())
      expect(await executeRemoteRecurringOperation(actor, next)).toEqual(
        results[index]
      )
    expect(await snapshot(actor)).toEqual(before)
    expect(before[6]).toHaveLength(operations.length)
    expect(before[7]).toHaveLength(operations.length)
    expect(before[0][0]).toMatchObject({
      revision: 3,
      title: "Edited root",
      deletedAt: expect.any(String),
    })
    expect(before[4][0]).toMatchObject({
      revision: 4,
      cancelled: true,
      slotKey: "2026-10-11",
    })
  }, 30000)

  test("rejects cross-family UUID reuse and foreign parent operations without exposing another actor", async () => {
    const actor = `${prefix}identity`,
      other = `${prefix}other`,
      itemId = crypto.randomUUID()
    const create = operation({ type: "item.create", itemId, input: draft() })
    expect(
      (await executeRemoteRecurringOperation(actor, create)).outcome.status
    ).toBe("applied")
    const appearance = operation(
      {
        type: "plan.cancel-occurrence",
        itemId,
        occurrenceId: `${itemId}:2026-10-11`,
        expectedOccurrenceRevision: 0,
      },
      1
    )
    const before = await snapshot(actor)
    await expect(
      executeRemoteRecurringOperation(actor, {
        ...appearance,
        operationId: create.operationId,
      })
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
    expect(await snapshot(actor)).toEqual(before)
    expect(
      await executeRemoteRecurringOperation(other, appearance)
    ).toMatchObject({
      kind: "plan-occurrence",
      userId: other,
      outcome: { status: "unavailable" },
    })
    expect(await snapshot(actor)).toEqual(before)
  })

  test("preserves strict active scope and incompatible historical receipts instead of relabeling them", async () => {
    const actor = `${prefix}history`,
      itemId = crypto.randomUUID()
    const create = operation({ type: "item.create", itemId, input: draft() })
    const historical = await executeRemoteOperationV4(actor, create)
    expect(historical.outcome.status).toBe("unsupported")
    // Active root rejection is not durable. Seed a valid historical receipt to test preservation.
    const receipts = await getCollection<Document & { _id: string }>(
      COLLECTION_NAMES.syncOperations
    )
    await receipts.insertOne({
      _id: crypto.randomUUID(),
      version: 2,
      actorUserId: actor,
      operationId: create.operationId,
      fingerprint: syncOperationFingerprint(create),
      result: historical,
      createdAt: "2026-10-11T09:00:00.000Z",
    })
    const before = await snapshot(actor)
    expect(await executeRemoteRecurringOperation(actor, create)).toEqual(
      historical
    )
    expect(await snapshot(actor)).toEqual(before)
    const appearance = operation(
      {
        type: "plan.cancel-occurrence",
        itemId,
        occurrenceId: `${itemId}:2026-10-11`,
        expectedOccurrenceRevision: 0,
      },
      1
    )
    const rejected = await executeRemoteOperationV4(actor, appearance)
    expect(rejected.outcome.status).toBe("unsupported")
    await receipts.insertOne({
      _id: crypto.randomUUID(),
      version: 2,
      actorUserId: actor,
      operationId: appearance.operationId,
      fingerprint: syncOperationFingerprint(appearance),
      result: rejected,
      createdAt: "2026-10-11T09:00:00.000Z",
    })
    const stored = await snapshot(actor)
    await expect(
      executeRemoteRecurringOperation(actor, appearance)
    ).rejects.toThrow("incompatible")
    expect(await snapshot(actor)).toEqual(stored)
    const missing = operation(
      {
        type: "plan.cancel-occurrence",
        itemId,
        occurrenceId: `${itemId}:2026-10-11`,
      },
      1
    )
    expect(await executeRemoteRecurringOperation(actor, missing)).toMatchObject(
      { kind: "plan-occurrence", outcome: { status: "unsupported" } }
    )
    await expect(executeRemoteRecurringOperation("", create)).rejects.toThrow()
    await expect(
      executeRemoteRecurringOperation(actor, { ...create, protocolVersion: 5 })
    ).rejects.toThrow()
  })
})
