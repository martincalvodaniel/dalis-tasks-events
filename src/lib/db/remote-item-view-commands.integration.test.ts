import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { applyItemCommand } from "@/lib/calendar/item-command"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { executeRemoteRecurringPlanOperation } from "@/lib/db/remote-item-commands"
import {
  executeRemoteItemViewOperation,
  executeRemotePlanItemViewOperation,
  executeRemoteRecurringItemViewOperation,
  stageRemoteItemViewOperation,
  stageRemoteRecurringItemViewOperation,
} from "@/lib/db/remote-item-view-commands"
import { RemoteItemViewRepository } from "@/lib/db/remote-item-views"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { readRemoteOperationReceipt } from "@/lib/db/remote-operation-receipts"
import { executeRemotePlanOccurrenceOperation } from "@/lib/db/remote-plan-occurrence-commands"
import { RemoteTagRepository } from "@/lib/db/remote-tags"
import { OperationIdentityReuseError } from "@/lib/sync/operation-identity-reuse"
import type { CalendarItemDraft } from "@/types/calendar-item"
import type { PlanDraft } from "@/types/plan-item"
import type { SyncOperation } from "@/types/sync"

const config = getSyncDatabaseTestConfig()
const prefix = `view-command-${config?.runId}-`
const timestamp = "2026-10-08T00:00:00.000Z"
const task: CalendarItemDraft = {
  kind: "task",
  title: "Owned task",
  description: "",
  scheduledDate: "2026-10-08",
  status: "in_progress",
  checklist: [],
  recurrence: null,
}
function setView(
  itemId: string,
  primaryTagId: string | null,
  baseRevision = 0
): SyncOperation {
  return {
    protocolVersion: 1,
    operationId: crypto.randomUUID(),
    baseRevision,
    command: { type: "item-view.set", itemId, primaryTagId },
  }
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
    position: 1024,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  expect(await (await RemoteTagRepository.open(actor)).insert(tag)).toBe(true)
  return tag
}
function recurringDraft(variant: PlanDraft["variant"]): PlanDraft {
  return {
    kind: "plan",
    variant,
    title: "Recurring plan",
    description: "Owned series",
    status: "not_started",
    checklist: [],
    schedule: {
      mode: "all_day",
      startDate: "2026-10-08",
      endDateExclusive: "2026-10-09",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-08",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
  }
}
async function seriesGuard(actor: string, itemId: string) {
  return (
    await getCollection<{ _id: string; token: string }>(
      COLLECTION_NAMES.planSeriesGuards
    )
  ).findOne({ _id: JSON.stringify([actor, itemId]) })
}
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
async function ownedDatabase() {
  if (!config) throw new Error("Sync test configuration is required")
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Item view command database does not match its owned run")
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

describe.skipIf(!config)("atomic remote item views", () => {
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
        [COLLECTION_NAMES.planSeriesGuards, "userId"],
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

  test("assigns, changes and clears categories while preserving content and exact replay", async () => {
    const actor = `${prefix}assign`
    const item = await itemFixture(actor)
    const firstTag = await tagFixture(actor, "First")
    const nextTag = await tagFixture(actor, "Second")
    const operation = setView(item.id, firstTag.id)
    const [first, duplicate] = await Promise.all([
      executeRemoteItemViewOperation(actor, operation),
      executeRemoteItemViewOperation(actor, operation),
    ])
    expect(first).toEqual(duplicate)
    if (first.kind !== "preference" || first.outcome.status !== "applied")
      throw new Error("Expected applied personal view")
    expect(first.outcome.effects.sequence).toBe(1)
    expect(first.outcome.effects.effects).toHaveLength(1)
    const repository = await RemoteItemViewRepository.open(actor)
    expect((await repository.read(item.id))?.primaryTagId).toBe(firstTag.id)
    expect(
      (
        await executeRemoteItemViewOperation(
          actor,
          setView(item.id, nextTag.id, 1)
        )
      ).outcome.status
    ).toBe("applied")
    expect((await repository.read(item.id))?.primaryTagId).toBe(nextTag.id)
    expect(
      (await executeRemoteItemViewOperation(actor, setView(item.id, null, 2)))
        .outcome.status
    ).toBe("applied")
    expect((await repository.read(item.id))?.primaryTagId).toBeNull()
    expect((await repository.read(item.id))?.revision).toBe(3)
    expect(
      (
        await executeRemoteItemViewOperation(
          actor,
          setView(item.id, nextTag.id, 1)
        )
      ).outcome.status
    ).toBe("conflict")
    const before = await history(actor)
    expect(before.counter?.sequence).toBe(3)
    expect(before.changes).toHaveLength(3)
    expect(before.receipts).toBe(4)
    expect(await executeRemoteItemViewOperation(actor, operation)).toEqual(
      first
    )
    await expect(
      executeRemoteItemViewOperation(actor, { ...operation, baseRevision: 1 })
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
    expect(await history(actor)).toEqual(before)
    expect(
      await (await RemoteItemRepository.open(actor)).read(item.id)
    ).toEqual(item)
  }, 30000)

  test("does not grant content access through personal views or foreign and deleted categories", async () => {
    const actor = `${prefix}access`
    const other = `${prefix}foreign`
    const ownItem = await itemFixture(actor)
    const foreignItem = await itemFixture(other)
    const foreignTag = await tagFixture(other, "Foreign")
    const ownTag = await tagFixture(actor, "Deleted")
    const ownViews = await RemoteItemViewRepository.open(actor)
    expect(
      await ownViews.insert({
        userId: actor,
        itemId: foreignItem.id,
        primaryTagId: null,
        revision: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      })
    ).toBe(true)
    expect(
      (
        await executeRemoteItemViewOperation(
          actor,
          setView(foreignItem.id, null, 1)
        )
      ).outcome.status
    ).toBe("unavailable")
    expect(
      (
        await executeRemoteItemViewOperation(
          actor,
          setView(ownItem.id, foreignTag.id)
        )
      ).outcome.status
    ).toBe("invalid_command")
    expect(
      await (await RemoteTagRepository.open(actor)).replace(1, {
        ...ownTag,
        revision: 2,
        deletedAt: timestamp,
      })
    ).toBe(true)
    expect(
      (
        await executeRemoteItemViewOperation(
          actor,
          setView(ownItem.id, ownTag.id)
        )
      ).outcome.status
    ).toBe("invalid_command")
    expect(
      await (await RemoteItemRepository.open(actor)).replace(1, {
        ...ownItem,
        revision: 2,
        deletedAt: timestamp,
      })
    ).toBe(true)
    expect(
      (await executeRemoteItemViewOperation(actor, setView(ownItem.id, null)))
        .outcome.status
    ).toBe("unavailable")
    expect(await ownViews.read(ownItem.id)).toBeNull()
    expect((await history(actor)).counter).toBeNull()
    expect((await history(actor)).changes).toHaveLength(0)
    expect((await ownViews.read(foreignItem.id))?.revision).toBe(1)
  }, 30000)

  test("rolls back the view, sequence, journal and receipt after a late failure", async () => {
    const actor = `${prefix}rollback`
    const item = await itemFixture(actor)
    const tag = await tagFixture(actor, "Own")
    const operation = setView(item.id, tag.id)
    const database = await ownedDatabase()
    await database.client.withSession(async (session) => {
      await expect(
        stageRemoteItemViewOperation(actor, operation, timestamp, session)
      ).rejects.toThrow("active transaction")
      await expect(
        session.withTransaction(async () => {
          const result = await stageRemoteItemViewOperation(
            actor,
            operation,
            timestamp,
            session
          )
          expect(result.outcome.status).toBe("applied")
          const receipt = await readRemoteOperationReceipt(
            actor,
            operation.operationId,
            session
          )
          if (!receipt) throw new Error("Expected staged receipt")
          expect(receipt.result).toEqual(result)
          expect(
            await readRemoteOperationReceipt(actor, operation.operationId)
          ).toBeNull()
          throw new Error("Intentional failure after personal view receipt")
        })
      ).rejects.toThrow("Intentional failure after personal view receipt")
    })
    expect(
      await (await RemoteItemViewRepository.open(actor)).read(item.id)
    ).toBeNull()
    expect(await history(actor)).toEqual({
      receipts: 0,
      changes: [],
      counter: null,
    })
    expect(
      (await executeRemoteItemViewOperation(actor, operation)).outcome.status
    ).toBe("applied")
    expect((await history(actor)).counter?.sequence).toBe(1)
  }, 30000)

  test("supports simple events while preserving unsupported birthdays and series without effects", async () => {
    const actor = `${prefix}kinds`
    const event = await itemFixture(actor, {
      kind: "event",
      title: "Own event",
      description: "",
      schedule: {
        mode: "all_day",
        startDate: "2026-10-08",
        endDateExclusive: "2026-10-09",
      },
      recurrence: null,
    })
    expect(
      (await executeRemoteItemViewOperation(actor, setView(event.id, null)))
        .outcome.status
    ).toBe("applied")
    const birthday = await itemFixture(actor, {
      kind: "birthday",
      title: "Own birthday",
      description: "",
      month: 10,
      day: 8,
      birthYear: null,
      timeZone: "Europe/Madrid",
    })
    const unsupported = setView(birthday.id, null)
    expect(
      (await executeRemoteItemViewOperation(actor, unsupported)).outcome.status
    ).toBe("unsupported")
    expect(
      await (await RemoteItemViewRepository.open(actor)).read(birthday.id)
    ).toBeNull()
    expect((await history(actor)).counter?.sequence).toBe(1)
    const unsupportedReceipt = await readRemoteOperationReceipt(
      actor,
      unsupported.operationId
    )
    expect(unsupportedReceipt?.result.outcome.status).toBe("unsupported")
    const recurring = await itemFixture(actor, {
      ...task,
      recurrence: {
        frequency: "daily",
        interval: 1,
        anchorDate: "2026-10-08",
        timeZone: "Europe/Madrid",
        end: { type: "never" },
      },
    })
    expect(
      (await executeRemoteItemViewOperation(actor, setView(recurring.id, null)))
        .outcome.status
    ).toBe("unsupported")
    expect(
      await (await RemoteItemViewRepository.open(actor)).read(recurring.id)
    ).toBeNull()
    expect((await history(actor)).counter?.sequence).toBe(1)
    await expect(
      executeRemoteItemViewOperation(actor, { ...unsupported, extra: true })
    ).rejects.toThrow()
  }, 30000)

  test("future series assignment preserves terminal history, parent content and a single replayed commit", async () => {
    for (const variant of ["task", "event", "appointment", "note"] as const) {
      const actor = `${prefix}series-${variant}`
      const item = await itemFixture(actor, recurringDraft(variant))
      const tag = await tagFixture(actor, "Series category")
      const historical = setView(item.id, tag.id)
      const old = await executeRemotePlanItemViewOperation(actor, historical)
      expect(old.outcome.status).toBe("unsupported")
      expect(
        await executeRemoteRecurringItemViewOperation(actor, historical)
      ).toEqual(old)
      expect(await seriesGuard(actor, item.id)).toBeNull()
      const operation = setView(item.id, tag.id)
      const [first, replay] = await Promise.all([
        executeRemoteRecurringItemViewOperation(actor, operation),
        executeRemoteRecurringItemViewOperation(actor, operation),
      ])
      expect(first).toEqual(replay)
      expect(first.outcome.status).toBe("applied")
      const guard = await seriesGuard(actor, item.id)
      expect(guard).not.toBeNull()
      const views = await RemoteItemViewRepository.open(actor)
      expect(await views.read(item.id)).toMatchObject({
        primaryTagId: tag.id,
        revision: 1,
      })
      expect(
        (
          await executeRemoteRecurringItemViewOperation(
            actor,
            setView(item.id, null)
          )
        ).outcome.status
      ).toBe("conflict")
      expect(await seriesGuard(actor, item.id)).toEqual(guard)
      expect(
        (
          await executeRemoteRecurringItemViewOperation(
            actor,
            setView(item.id, null, 1)
          )
        ).outcome.status
      ).toBe("applied")
      expect(await views.read(item.id)).toMatchObject({
        primaryTagId: null,
        revision: 2,
      })
      expect((await seriesGuard(actor, item.id))?.token).not.toBe(guard?.token)
      const before = await history(actor)
      const guardBeforeReplay = await seriesGuard(actor, item.id)
      expect(
        await executeRemoteRecurringItemViewOperation(actor, operation)
      ).toEqual(first)
      expect(await history(actor)).toEqual(before)
      expect(before).toMatchObject({ receipts: 4, counter: { sequence: 2 } })
      expect(before.changes).toHaveLength(2)
      expect(await seriesGuard(actor, item.id)).toEqual(guardBeforeReplay)
      expect(
        await (await RemoteItemRepository.open(actor)).read(item.id)
      ).toEqual(item)
      await expect(
        executeRemoteRecurringItemViewOperation(actor, {
          ...operation,
          baseRevision: 1,
        })
      ).rejects.toBeInstanceOf(OperationIdentityReuseError)
    }
  }, 30000)

  test("future view receipts share appearance identity and retain ownership authorization", async () => {
    const actor = `${prefix}series-identity`,
      foreign = `${prefix}series-foreign`
    const item = await itemFixture(actor, recurringDraft("task"))
    const foreignItem = await itemFixture(foreign, recurringDraft("note"))
    const ownTag = await tagFixture(actor, "Own series category")
    const foreignTag = await tagFixture(foreign, "Foreign series category")
    expect(
      (
        await executeRemoteRecurringItemViewOperation(
          actor,
          setView(foreignItem.id, null)
        )
      ).outcome.status
    ).toBe("unavailable")
    expect(
      (
        await executeRemoteRecurringItemViewOperation(
          actor,
          setView(item.id, foreignTag.id)
        )
      ).outcome.status
    ).toBe("invalid_command")
    expect(await seriesGuard(actor, item.id)).toBeNull()
    const appearance: SyncOperation = {
      protocolVersion: 1,
      operationId: crypto.randomUUID(),
      baseRevision: 1,
      command: {
        type: "plan.set-occurrence-status",
        itemId: item.id,
        occurrenceId: `${item.id}:2026-10-08`,
        expectedOccurrenceRevision: 0,
        status: "completed",
      },
    }
    expect(
      (await executeRemotePlanOccurrenceOperation(actor, appearance)).outcome
        .status
    ).toBe("applied")
    const before = await history(actor),
      guard = await seriesGuard(actor, item.id)
    await expect(
      executeRemoteRecurringItemViewOperation(actor, {
        ...setView(item.id, ownTag.id),
        operationId: appearance.operationId,
      })
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
    expect(await history(actor)).toEqual(before)
    expect(await seriesGuard(actor, item.id)).toEqual(guard)
    expect(
      await (await RemoteItemViewRepository.open(actor)).read(item.id)
    ).toBeNull()
  }, 30000)

  test("future series view rollback includes its guard and late receipt, then retry commits exactly once", async () => {
    const actor = `${prefix}series-rollback`
    const item = await itemFixture(actor, recurringDraft("appointment"))
    const op = setView(item.id, null)
    const database = await ownedDatabase()
    await database.client.withSession(async (session) => {
      await expect(
        stageRemoteRecurringItemViewOperation(actor, op, timestamp, session)
      ).rejects.toThrow("active transaction")
      await expect(
        session.withTransaction(async () => {
          expect(
            (
              await stageRemoteRecurringItemViewOperation(
                actor,
                op,
                timestamp,
                session
              )
            ).outcome.status
          ).toBe("applied")
          expect(
            await readRemoteOperationReceipt(actor, op.operationId, session)
          ).not.toBeNull()
          expect(
            await readRemoteOperationReceipt(actor, op.operationId)
          ).toBeNull()
          expect(await seriesGuard(actor, item.id)).toBeNull()
          throw new Error("Intentional failure after recurring view receipt")
        })
      ).rejects.toThrow("Intentional failure after recurring view receipt")
    })
    expect(await seriesGuard(actor, item.id)).toBeNull()
    expect(await history(actor)).toEqual({
      receipts: 0,
      changes: [],
      counter: null,
    })
    expect(
      await (await RemoteItemViewRepository.open(actor)).read(item.id)
    ).toBeNull()
    const first = await executeRemoteRecurringItemViewOperation(actor, op)
    expect(first.outcome.status).toBe("applied")
    expect(await executeRemoteRecurringItemViewOperation(actor, op)).toEqual(
      first
    )
    expect(await history(actor)).toMatchObject({
      receipts: 1,
      counter: { sequence: 1 },
    })
  }, 30000)

  test("parent changes overlapping view snapshots force a full reread before commit", async () => {
    for (const deletion of [false, true]) {
      const actor = `${prefix}series-race-${deletion}`
      const input = recurringDraft("event")
      const item = await itemFixture(actor, input)
      const paused = deferred(),
        resume = deferred()
      const read = RemoteItemRepository.prototype.read
      let first = true,
        reads = 0
      RemoteItemRepository.prototype.read = async function (id) {
        const current = await read.call(this, id)
        if (current?.id === item.id && current.ownerId === actor) {
          reads++
          if (first) {
            first = false
            paused.resolve()
            await resume.promise
          }
        }
        return current
      }
      let running:
        | ReturnType<typeof executeRemoteRecurringItemViewOperation>
        | undefined
      try {
        running = executeRemoteRecurringItemViewOperation(
          actor,
          setView(item.id, null)
        )
        await paused.promise
        const changed = await executeRemoteRecurringPlanOperation(actor, {
          protocolVersion: 1,
          operationId: crypto.randomUUID(),
          baseRevision: 1,
          command: deletion
            ? { type: "item.delete", itemId: item.id }
            : {
                type: "item.update",
                itemId: item.id,
                input: { ...input, title: "Concurrent edit" },
              },
        })
        expect(changed.status).toBe("applied")
        const guard = await seriesGuard(actor, item.id)
        resume.resolve()
        expect((await running).outcome.status).toBe(
          deletion ? "unavailable" : "applied"
        )
        expect(reads).toBeGreaterThanOrEqual(3)
        const view = await (await RemoteItemViewRepository.open(actor)).read(
          item.id
        )
        if (deletion) {
          expect(view).toBeNull()
          expect(await seriesGuard(actor, item.id)).toEqual(guard)
        } else {
          expect(view?.revision).toBe(1)
          expect((await seriesGuard(actor, item.id))?.token).not.toBe(
            guard?.token
          )
        }
        expect(await history(actor)).toMatchObject({
          receipts: 2,
          counter: { sequence: deletion ? 1 : 2 },
        })
        expect(
          await read.call(await RemoteItemRepository.open(actor), item.id)
        ).toMatchObject({
          revision: 2,
          ...(deletion
            ? { deletedAt: expect.any(String) }
            : { title: "Concurrent edit" }),
        })
      } finally {
        resume.resolve()
        await running?.catch(() => undefined)
        RemoteItemRepository.prototype.read = read
      }
    }
  }, 30000)
})
