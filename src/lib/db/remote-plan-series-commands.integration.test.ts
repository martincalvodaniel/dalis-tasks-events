import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import {
  executeRemotePlanOperation,
  executeRemoteRecurringPlanOperation,
  OperationIdentityReuseError,
} from "@/lib/db/remote-item-commands"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { readRemoteOperationReceipt } from "@/lib/db/remote-operation-receipts"
import type { PlanDraft } from "@/types/plan-item"
import type { SyncCommand, SyncOperation } from "@/types/sync"

const config = getSyncDatabaseTestConfig()
function draft(): PlanDraft {
  return {
    kind: "plan",
    variant: "appointment",
    title: "Recurring series",
    description: "Independent appearance progress",
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
    status: "not_started",
    checklist: [],
  }
}
function operation(command: SyncCommand, baseRevision = 0): SyncOperation {
  return {
    operationId: randomUUID(),
    protocolVersion: 1,
    baseRevision,
    command,
  }
}
async function ownedDatabase() {
  if (!config) throw new Error("Sync test configuration is required")
  const db = await getDatabase()
  if (db.databaseName !== config.mongodbDatabase)
    throw new Error(
      "Series executor test database does not match its owned run"
    )
  return db
}
async function guard(actor: string, seriesId: string) {
  return (
    await getCollection<{ _id: string; token: string }>(
      COLLECTION_NAMES.planSeriesGuards
    )
  ).findOne({
    _id: JSON.stringify([actor, seriesId]),
  })
}
async function counts(actor: string) {
  return {
    receipts: await (
      await getCollection(COLLECTION_NAMES.syncOperations)
    ).countDocuments({ actorUserId: actor }),
    changes: await (
      await getCollection(COLLECTION_NAMES.syncChanges)
    ).countDocuments({ recipientUserId: actor }),
    counter: await (
      await getCollection<{ _id: string; sequence: number }>(
        COLLECTION_NAMES.syncCounters
      )
    ).findOne({ _id: actor }),
  }
}

describe.skipIf(!config)("prepared guarded recurring series executor", () => {
  beforeAll(ownedDatabase, 30000)
  afterAll(closeDatabaseConnection)

  test("creates, edits and deletes with one guard and durable replay; current scope stays strict", async () => {
    const actor = randomUUID()
    const itemId = randomUUID()
    const input = draft()
    const create = operation({ type: "item.create", itemId, input })
    expect(await executeRemotePlanOperation(actor, create)).toMatchObject({
      status: "unsupported",
    })
    expect(await counts(actor)).toEqual({
      receipts: 0,
      changes: 0,
      counter: null,
    })
    const saved = await executeRemoteRecurringPlanOperation(actor, create)
    expect(saved).toMatchObject({
      status: "applied",
      item: { revision: 1, recurrence: input.recurrence },
    })
    const initial = await guard(actor, itemId)
    expect(initial).not.toBeNull()
    const edit = operation(
      {
        type: "item.update",
        itemId,
        input: { ...input, title: "Edited series" },
      },
      1
    )
    const changed = await executeRemoteRecurringPlanOperation(actor, edit)
    expect(changed).toMatchObject({
      status: "applied",
      item: { title: "Edited series", revision: 2 },
    })
    const editedGuard = await guard(actor, itemId)
    expect(editedGuard?.token).not.toBe(initial?.token)
    expect(await executeRemoteRecurringPlanOperation(actor, edit)).toEqual(
      changed
    )
    expect(await guard(actor, itemId)).toEqual(editedGuard)
    const remove = operation({ type: "item.delete", itemId }, 2)
    expect(
      await executeRemoteRecurringPlanOperation(actor, remove)
    ).toMatchObject({ status: "applied", item: { revision: 3 } })
    expect((await guard(actor, itemId))?.token).not.toBe(editedGuard?.token)
    expect(await executeRemoteRecurringPlanOperation(actor, create)).toEqual(
      saved
    )
    expect(await executeRemotePlanOperation(actor, create)).toMatchObject({
      status: "unsupported",
    })
    expect(await executeRemotePlanOperation(actor, remove)).toMatchObject({
      status: "unsupported",
    })
    await expect(
      executeRemoteRecurringPlanOperation(actor, {
        ...edit,
        command: {
          ...edit.command,
          input: { ...input, title: "Changed identity" },
        },
      })
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
    const actual = await counts(actor)
    expect(actual).toMatchObject({
      receipts: 3,
      changes: 3,
      counter: { sequence: 3 },
    })
    expect(
      (await (await RemoteItemRepository.open(actor)).read(itemId))?.deletedAt
    ).not.toBeNull()
  }, 30000)

  test("isolates ownership, preserves root progress and serializes competing edits", async () => {
    const actor = randomUUID()
    const foreign = randomUUID()
    const itemId = randomUUID()
    const input = draft()
    await executeRemoteRecurringPlanOperation(
      actor,
      operation({ type: "item.create", itemId, input })
    )
    const before = await guard(actor, itemId)
    const progress = operation(
      { type: "plan.set-status", itemId, status: "completed" },
      1
    )
    expect(
      await executeRemoteRecurringPlanOperation(actor, progress)
    ).toMatchObject({ status: "unsupported" })
    expect(
      await readRemoteOperationReceipt(actor, progress.operationId)
    ).toBeNull()
    expect(await guard(actor, itemId)).toEqual(before)
    expect(
      await executeRemoteRecurringPlanOperation(
        foreign,
        operation({ type: "item.delete", itemId }, 1)
      )
    ).toMatchObject({ status: "unavailable" })
    expect(await guard(foreign, itemId)).toBeNull()
    const results = await Promise.all(
      ["Left edit", "Right edit"].map((title) =>
        executeRemoteRecurringPlanOperation(
          actor,
          operation(
            { type: "item.update", itemId, input: { ...input, title } },
            1
          )
        )
      )
    )
    expect(results.map((r) => r.status).sort()).toEqual(["applied", "conflict"])
    expect(await counts(actor)).toMatchObject({
      receipts: 3,
      changes: 2,
      counter: { sequence: 2 },
    })
    expect(
      await (await RemoteItemRepository.open(actor)).read(itemId)
    ).toMatchObject({ status: "not_started" })
  }, 30000)

  test("late journal failure rolls back the guard and all effects before a clean retry", async () => {
    const db = await ownedDatabase()
    const actor = randomUUID()
    const itemId = randomUUID()
    const input = draft()
    const create = operation({ type: "item.create", itemId, input })
    const repo = await RemoteItemRepository.open(actor)
    await db.command({
      collMod: COLLECTION_NAMES.syncChanges,
      validator: { sequence: { $lt: 0 } },
      validationLevel: "strict",
      validationAction: "error",
    })
    try {
      await expect(
        executeRemoteRecurringPlanOperation(actor, create)
      ).rejects.toThrow()
      expect(await repo.read(itemId)).toBeNull()
      expect(await guard(actor, itemId)).toBeNull()
      expect(await counts(actor)).toEqual({
        receipts: 0,
        changes: 0,
        counter: null,
      })
    } finally {
      await db.command({ collMod: COLLECTION_NAMES.syncChanges, validator: {} })
    }
    await executeRemoteRecurringPlanOperation(actor, create)
    const before = await guard(actor, itemId)
    const edit = operation(
      { type: "item.update", itemId, input: { ...input, recurrence: null } },
      1
    )
    await db.command({
      collMod: COLLECTION_NAMES.syncChanges,
      validator: { sequence: { $lt: 0 } },
      validationLevel: "strict",
      validationAction: "error",
    })
    try {
      await expect(
        executeRemoteRecurringPlanOperation(actor, edit)
      ).rejects.toThrow()
      expect(await guard(actor, itemId)).toEqual(before)
      expect(await repo.read(itemId)).toMatchObject({
        recurrence: input.recurrence,
      })
      expect(await counts(actor)).toMatchObject({
        receipts: 1,
        changes: 1,
        counter: { sequence: 1 },
      })
    } finally {
      await db.command({ collMod: COLLECTION_NAMES.syncChanges, validator: {} })
    }
    expect(
      await executeRemoteRecurringPlanOperation(actor, edit)
    ).toMatchObject({
      status: "applied",
      item: { revision: 2, recurrence: null },
    })
    expect((await guard(actor, itemId))?.token).not.toBe(before?.token)
  }, 30000)
})
