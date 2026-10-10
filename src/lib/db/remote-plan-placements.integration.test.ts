import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { applyItemCommand } from "@/lib/calendar/item-command"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import {
  readRemoteChangesV2,
  readRemotePlanChangesV2,
} from "@/lib/db/remote-changes-v2"
import { RemoteItemViewRepository } from "@/lib/db/remote-item-views"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { executeRemoteOperationV3 } from "@/lib/db/remote-operation-commands-v3"
import { executeRemoteOperationV4 } from "@/lib/db/remote-operation-commands-v4"
import { RemoteTaskPlacementRepository } from "@/lib/db/remote-task-placements"
import { overduePlacementDate } from "@/schemas/ordering"
import { planVariantSchema } from "@/schemas/plan-item"
import type { PlanDraft, PlanVariant } from "@/types/plan-item"
import type { SyncCommand, SyncOperation } from "@/types/sync"

const config = getSyncDatabaseTestConfig()
const timestamp = "2026-10-10T00:00:00.000Z"
function operation(command: SyncCommand, baseRevision = 0): SyncOperation {
  return {
    operationId: randomUUID(),
    protocolVersion: 1,
    baseRevision,
    command,
  }
}
function draft(variant: PlanVariant = "task"): PlanDraft {
  return {
    kind: "plan",
    variant,
    title: "Owned common plan",
    description: "Unchanged content",
    schedule: {
      mode: "all_day",
      startDate: "2026-10-10",
      endDateExclusive: "2026-10-13",
    },
    status: "in_progress",
    checklist: [],
    recurrence: null,
  }
}
async function itemFixture(actor: string, input = draft()) {
  const item = applyItemCommand(
    null,
    { type: "item.create", itemId: randomUUID(), input },
    actor,
    timestamp
  )
  item.revision = 1
  expect(await (await RemoteItemRepository.open(actor)).insert(item)).toBe(true)
  return item
}
function move(
  itemId: string,
  baseRevision = 0,
  date = "2026-10-12",
  scope: "day" | "overdue" = "day"
) {
  return operation(
    {
      type: "task.move",
      itemId,
      occurrenceId: null,
      scope,
      date,
      tagId: null,
      beforeId: null,
      afterId: null,
    },
    baseRevision
  )
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
    sequence:
      (
        await (
          await getCollection<{ _id: string; sequence: number }>(
            COLLECTION_NAMES.syncCounters
          )
        ).findOne({ _id: actor })
      )?.sequence ?? 0,
  }
}

describe.skipIf(!config)("generation-four common plan placements", () => {
  beforeAll(async () => {
    if (!config) throw new Error("Sync test configuration is required")
    const database = await getDatabase()
    if (database.databaseName !== config.mongodbDatabase)
      throw new Error("Common placement tests require their owned database")
    await ensureIndexes(
      database,
      INDEX_SPECS.filter((spec) =>
        [
          COLLECTION_NAMES.tags,
          COLLECTION_NAMES.itemViews,
          COLLECTION_NAMES.taskPlacements,
        ].some((collection) => collection === spec.collection)
      )
    )
  }, 30000)
  afterAll(closeDatabaseConnection)

  for (const variant of planVariantSchema.options) {
    test(`${variant} moves and replays with an exact common reader while generation three rejects`, async () => {
      const actor = randomUUID()
      const item = await itemFixture(actor, draft(variant))
      const command = move(item.id)
      const before = JSON.stringify(command)
      expect(await executeRemoteOperationV3(actor, command)).toMatchObject({
        outcome: { status: "unsupported" },
      })
      expect((await history(actor)).receipts).toBe(0)
      const moved = await executeRemoteOperationV4(actor, command)
      expect(moved).toMatchObject({
        kind: "preference",
        outcome: { status: "applied" },
      })
      expect(await executeRemoteOperationV4(actor, command)).toEqual(moved)
      const stored = await history(actor)
      expect(stored.receipts).toBe(1)
      expect(stored.changes).toHaveLength(1)
      expect(stored.sequence).toBe(1)
      expect(await executeRemoteOperationV3(actor, command)).toMatchObject({
        outcome: { status: "unsupported" },
      })
      expect(await history(actor)).toEqual(stored)
      const page = await readRemotePlanChangesV2(actor, { after: 0 })
      expect(page.changes).toHaveLength(1)
      expect(page.nextAfter).toBe(1)
      await expect(readRemoteChangesV2(actor, { after: 0 })).rejects.toThrow(
        "Journal task placement access is unavailable"
      )
      expect(
        await (await RemoteItemRepository.open(actor)).read(item.id)
      ).toEqual(item)
      expect(JSON.stringify(command)).toBe(before)
    }, 30000)
  }

  test("interval-day membership and declared overdue days use independent canonical placements", async () => {
    const actor = randomUUID()
    const item = await itemFixture(actor, draft("appointment"))
    const first = move(item.id, 0, "2026-10-10")
    const second = move(item.id, 0, "2026-10-12")
    for (const command of [first, second])
      expect(await executeRemoteOperationV4(actor, command)).toMatchObject({
        outcome: { status: "applied" },
      })
    expect(
      await executeRemoteOperationV4(actor, move(item.id, 0, "2026-10-13"))
    ).toMatchObject({ outcome: { status: "invalid_command" } })
    expect(
      await executeRemoteOperationV4(
        actor,
        move(item.id, 0, "2026-10-12", "overdue")
      )
    ).toMatchObject({ outcome: { status: "invalid_command" } })
    const overdue = move(item.id, 0, "2026-10-13", "overdue")
    expect(await executeRemoteOperationV4(actor, overdue)).toMatchObject({
      outcome: { status: "applied" },
    })
    const placements = await (
      await RemoteTaskPlacementRepository.open(actor)
    ).catalog()
    expect(
      placements.map((record) => [record.scope, record.date]).toSorted()
    ).toEqual(
      [
        ["day", "2026-10-10"],
        ["day", "2026-10-12"],
        ["overdue", overduePlacementDate],
      ].toSorted()
    )
    expect(await executeRemoteOperationV4(actor, overdue)).toMatchObject({
      outcome: { status: "applied" },
    })
    expect(
      (await (await RemoteItemRepository.open(actor)).read(item.id))?.revision
    ).toBe(1)
  }, 30000)

  test("mismatched peers and foreign owners retain placements while primary CAS races produce one winner", async () => {
    const actor = randomUUID()
    const item = await itemFixture(actor, draft("note"))
    const wrongPeer = await itemFixture(actor, {
      ...draft("event"),
      schedule: {
        mode: "all_day",
        startDate: "2026-10-20",
        endDateExclusive: "2026-10-21",
      },
    })
    const mismatch = move(item.id)
    if (mismatch.command.type !== "task.move")
      throw new Error("Expected movement")
    mismatch.command.beforeId = wrongPeer.id
    expect(await executeRemoteOperationV4(actor, mismatch)).toMatchObject({
      outcome: { status: "invalid_command" },
    })
    expect(
      await executeRemoteOperationV4(randomUUID(), move(item.id))
    ).toMatchObject({ outcome: { status: "unavailable" } })
    const attempts = [move(item.id), move(item.id)]
    const results = await Promise.all(
      attempts.map((command) => executeRemoteOperationV4(actor, command))
    )
    expect(results.map((result) => result.outcome.status).toSorted()).toEqual([
      "applied",
      "conflict",
    ])
    for (let index = 0; index < attempts.length; index++)
      expect(await executeRemoteOperationV4(actor, attempts[index])).toEqual(
        results[index]
      )
    const placements = await (
      await RemoteTaskPlacementRepository.open(actor)
    ).catalog()
    expect(placements).toHaveLength(1)
    expect(placements[0].revision).toBe(1)
    expect((await history(actor)).sequence).toBe(1)
  }, 30000)

  test("history remains authorized after completion, rescheduling and soft deletion", async () => {
    const actor = randomUUID()
    const input = draft("event")
    const item = await itemFixture(actor, input)
    const command = move(item.id)
    const moved = await executeRemoteOperationV4(actor, command)
    await executeRemoteOperationV4(
      actor,
      operation(
        { type: "plan.set-status", itemId: item.id, status: "completed" },
        1
      )
    )
    await executeRemoteOperationV4(
      actor,
      operation(
        {
          type: "item.update",
          itemId: item.id,
          input: {
            ...input,
            status: "completed",
            schedule: {
              mode: "all_day",
              startDate: "2027-01-10",
              endDateExclusive: "2027-01-11",
            },
          },
        },
        2
      )
    )
    await executeRemoteOperationV4(
      actor,
      operation({ type: "item.delete", itemId: item.id }, 3)
    )
    const page = await readRemotePlanChangesV2(actor, { after: 0 })
    expect(page.nextAfter).toBe(4)
    expect(page.changes).toHaveLength(4)
    expect(await executeRemoteOperationV4(actor, command)).toEqual(moved)
    expect(await executeRemoteOperationV3(actor, command)).toMatchObject({
      outcome: { status: "unsupported" },
    })
    await (
      await getCollection<{ _id: string }>(COLLECTION_NAMES.items)
    ).deleteOne({ _id: item.id })
    await expect(readRemotePlanChangesV2(actor, { after: 0 })).rejects.toThrow()
  }, 30000)

  test("a legacy target with common-plan peer effects cannot be acknowledged by generation three", async () => {
    const actor = randomUUID()
    const peer = await itemFixture(actor, draft("note"))
    const task = applyItemCommand(
      null,
      {
        type: "item.create",
        itemId: randomUUID(),
        input: {
          kind: "task",
          title: "Legacy peer",
          description: "",
          scheduledDate: "2026-10-12",
          status: "not_started",
          checklist: [],
          recurrence: null,
        },
      },
      actor,
      timestamp
    )
    task.revision = 1
    expect(await (await RemoteItemRepository.open(actor)).insert(task)).toBe(
      true
    )
    const command = move(task.id)
    if (command.command.type !== "task.move")
      throw new Error("Expected movement")
    command.command.beforeId = peer.id
    const result = await executeRemoteOperationV4(actor, command)
    if (result.kind !== "preference" || result.outcome.status !== "applied")
      throw new Error("Expected mixed placement")
    expect(
      result.outcome.effects.effects
        .filter((effect) => effect.store === "taskPlacements")
        .map((effect) => effect.record.occurrenceId)
        .toSorted()
    ).toEqual([task.id, peer.id].toSorted())
    const saved = await history(actor)
    expect(await executeRemoteOperationV3(actor, command)).toMatchObject({
      outcome: { status: "unsupported" },
    })
    expect(await history(actor)).toEqual(saved)
    expect(await executeRemoteOperationV4(actor, command)).toEqual(result)
    expect((await readRemotePlanChangesV2(actor, { after: 0 })).nextAfter).toBe(
      1
    )
  }, 30000)

  test("a failed journal insert rolls back all placement and view effects", async () => {
    const actor = randomUUID()
    const item = await itemFixture(actor)
    const command = move(item.id)
    const database = await getDatabase()
    await database.command({
      collMod: COLLECTION_NAMES.syncChanges,
      validator: { sequence: { $lt: 0 } },
      validationLevel: "strict",
      validationAction: "error",
    })
    try {
      await expect(executeRemoteOperationV4(actor, command)).rejects.toThrow()
      expect(
        await (await RemoteTaskPlacementRepository.open(actor)).catalog()
      ).toEqual([])
      expect(
        await (await RemoteItemViewRepository.open(actor)).read(item.id)
      ).toBeNull()
      expect(await history(actor)).toEqual({
        receipts: 0,
        changes: [],
        sequence: 0,
      })
    } finally {
      await database.command({
        collMod: COLLECTION_NAMES.syncChanges,
        validator: {},
      })
    }
    expect(await executeRemoteOperationV4(actor, command)).toMatchObject({
      outcome: { status: "applied" },
    })
    expect((await history(actor)).sequence).toBe(1)
  }, 30000)

  test("recurring plans and occurrence identities remain unsupported", async () => {
    const actor = randomUUID()
    const item = await itemFixture(actor, {
      ...draft(),
      recurrence: {
        frequency: "daily",
        interval: 1,
        anchorDate: "2026-10-10",
        timeZone: "Europe/Madrid",
        end: { type: "never" },
      },
    })
    expect(await executeRemoteOperationV4(actor, move(item.id))).toMatchObject({
      outcome: { status: "unsupported" },
    })
    const simple = await itemFixture(actor, draft("note"))
    const command = move(simple.id)
    if (command.command.type !== "task.move")
      throw new Error("Expected movement")
    command.command.occurrenceId = `${simple.id}:2026-10-12`
    expect(await executeRemoteOperationV4(actor, command)).toMatchObject({
      outcome: { status: "unsupported" },
    })
    expect((await history(actor)).sequence).toBe(0)
    expect(
      await (await RemoteTaskPlacementRepository.open(actor)).catalog()
    ).toEqual([])
  }, 30000)
})
