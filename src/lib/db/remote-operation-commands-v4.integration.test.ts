import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { getSyncDatabaseTestConfig } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { OperationIdentityReuseError } from "@/lib/db/remote-item-commands"
import { RemoteItemViewRepository } from "@/lib/db/remote-item-views"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { executeRemoteOperationV3 } from "@/lib/db/remote-operation-commands-v3"
import { executeRemoteOperationV4 } from "@/lib/db/remote-operation-commands-v4"
import { planVariantSchema } from "@/schemas/plan-item"
import type { PlanDraft } from "@/types/plan-item"
import type { SyncCommand, SyncOperation } from "@/types/sync"

const config = getSyncDatabaseTestConfig()
function draft(variant: PlanDraft["variant"] = "task"): PlanDraft {
  return {
    kind: "plan",
    variant,
    title: "Common plan",
    description: "Shared options",
    schedule: {
      mode: "all_day",
      startDate: "2026-10-10",
      endDateExclusive: "2026-10-11",
    },
    status: "not_started",
    checklist: [{ id: randomUUID(), text: "First step", completed: false }],
    recurrence: null,
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
function create(input = draft()): SyncOperation {
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

describe.skipIf(!config)("generation-four atomic common plan executor", () => {
  beforeAll(async () => {
    if (!config) throw new Error("Sync test configuration is required")
    const database = await getDatabase()
    expect(database.databaseName).toBe(config.mongodbDatabase)
    await ensureIndexes(
      database,
      INDEX_SPECS.filter(
        (spec) =>
          spec.collection === COLLECTION_NAMES.tags ||
          spec.collection === COLLECTION_NAMES.itemViews
      )
    )
  }, 30000)
  afterAll(closeDatabaseConnection)

  for (const variant of planVariantSchema.options) {
    test(`${variant} shares create, update, checklist, progress and deletion`, async () => {
      const owner = randomUUID()
      const input = draft(variant)
      const first = create(input)
      const created = await executeRemoteOperationV4(owner, first)
      if (created.kind !== "item" || created.outcome.status !== "applied")
        throw new Error("Expected applied plan")
      const itemId = created.outcome.item.id
      expect(created.outcome.item).toMatchObject({
        kind: "plan",
        variant,
        ownerId: owner,
        revision: 1,
        completedAt: null,
      })
      const edit = operation(
        {
          type: "item.update",
          itemId,
          input: { ...input, title: "Edited plan" },
        },
        1
      )
      const edited = await executeRemoteOperationV4(owner, edit)
      expect(edited).toMatchObject({
        kind: "item",
        outcome: {
          status: "applied",
          item: { title: "Edited plan", revision: 2 },
        },
      })
      const checklist = operation(
        {
          type: "plan.set-checklist-entry",
          itemId,
          entryId: input.checklist[0].id,
          completed: true,
        },
        2
      )
      const checked = await executeRemoteOperationV4(owner, checklist)
      expect(checked).toMatchObject({
        kind: "item",
        outcome: {
          status: "applied",
          item: { revision: 3, checklist: [{ completed: true }] },
        },
      })
      const progress = operation(
        { type: "plan.set-status", itemId, status: "in_progress" },
        3
      )
      expect(await executeRemoteOperationV4(owner, progress)).toMatchObject({
        outcome: {
          status: "applied",
          item: { status: "in_progress", completedAt: null, revision: 4 },
        },
      })
      const finish = operation(
        { type: "plan.set-status", itemId, status: "completed" },
        4
      )
      const completed = await executeRemoteOperationV4(owner, finish)
      if (
        completed.kind !== "item" ||
        completed.outcome.status !== "applied" ||
        completed.outcome.item.kind !== "plan"
      )
        throw new Error("Expected completed plan")
      expect(completed.outcome.item.completedAt).not.toBeNull()
      expect(await executeRemoteOperationV4(owner, finish)).toEqual(completed)
      const reopen = operation(
        { type: "plan.set-status", itemId, status: "not_started" },
        5
      )
      expect(await executeRemoteOperationV4(owner, reopen)).toMatchObject({
        outcome: {
          status: "applied",
          item: { completedAt: null, revision: 6 },
        },
      })
      const removed = await executeRemoteOperationV4(
        owner,
        operation({ type: "item.delete", itemId }, 6)
      )
      expect(removed).toMatchObject({
        kind: "item",
        outcome: { status: "applied", item: { revision: 7 } },
      })
      expect(
        (await (await RemoteItemRepository.open(owner)).read(itemId))?.deletedAt
      ).not.toBeNull()
      expect(await executeRemoteOperationV4(owner, first)).toEqual(created)
      const counts = await records(owner)
      expect(counts.receipts).toBe(7)
      expect(counts.changes.map((change) => change.sequence)).toEqual([
        1, 2, 3, 4, 5, 6, 7,
      ])
      expect(counts.sequence).toBe(7)
    }, 30000)
  }

  test("generation three rejects plan commands and plan replays without new receipts", async () => {
    const owner = randomUUID()
    const first = create()
    expect(await executeRemoteOperationV3(owner, first)).toMatchObject({
      kind: "item",
      outcome: { status: "unsupported" },
    })
    expect((await records(owner)).receipts).toBe(0)
    const saved = await executeRemoteOperationV4(owner, first)
    if (saved.kind !== "item" || saved.outcome.status !== "applied")
      throw new Error("Expected applied creation")
    const update = operation(
      {
        type: "plan.set-status",
        itemId: saved.outcome.item.id,
        status: "completed",
      },
      1
    )
    const completed = await executeRemoteOperationV4(owner, update)
    const removal = operation(
      { type: "item.delete", itemId: saved.outcome.item.id },
      2
    )
    await executeRemoteOperationV4(owner, removal)
    const before = await records(owner)
    for (const command of [first, update, removal]) {
      expect(await executeRemoteOperationV3(owner, command)).toMatchObject({
        outcome: { status: "unsupported" },
      })
    }
    expect(await records(owner)).toEqual(before)
    expect(await executeRemoteOperationV4(owner, update)).toEqual(completed)
    await expect(
      executeRemoteOperationV3(owner, {
        ...first,
        command: {
          ...first.command,
          input: { ...draft(), title: "Changed identity" },
        },
      })
    ).rejects.toBeInstanceOf(OperationIdentityReuseError)
    expect(await records(owner)).toEqual(before)
  }, 30000)

  test("race and late replay preserve exact CAS outcomes and receipts", async () => {
    const owner = randomUUID()
    const first = create()
    const creations = await Promise.all(
      Array.from({ length: 4 }, () => executeRemoteOperationV4(owner, first))
    )
    expect(
      creations.every(
        (result) => JSON.stringify(result) === JSON.stringify(creations[0])
      )
    ).toBe(true)
    const saved = creations[0]
    if (saved.kind !== "item" || saved.outcome.status !== "applied")
      throw new Error("Expected applied creation")
    const itemId = saved.outcome.item.id
    const updates = ["in_progress", "completed"].map((status) =>
      operation(
        {
          type: "plan.set-status",
          itemId,
          status: status as "in_progress" | "completed",
        },
        1
      )
    )
    const outcomes = await Promise.all(
      updates.map((update) => executeRemoteOperationV4(owner, update))
    )
    expect(outcomes.map((result) => result.outcome.status).toSorted()).toEqual([
      "applied",
      "conflict",
    ])
    await executeRemoteOperationV4(
      owner,
      operation({ type: "item.delete", itemId }, 2)
    )
    const before = await records(owner)
    for (let index = 0; index < updates.length; index++)
      expect(await executeRemoteOperationV4(owner, updates[index])).toEqual(
        outcomes[index]
      )
    expect(await records(owner)).toEqual(before)
    expect(before.receipts).toBe(4)
    expect(before.changes.map((change) => change.sequence)).toEqual([1, 2, 3])
  }, 30000)

  test("foreign identities, missing plans and invalid checklist targets disclose no data", async () => {
    const owner = randomUUID()
    const foreign = randomUUID()
    const first = create()
    const saved = await executeRemoteOperationV4(owner, first)
    if (saved.kind !== "item" || saved.outcome.status !== "applied")
      throw new Error("Expected applied creation")
    const itemId = saved.outcome.item.id
    for (const command of [
      first,
      operation({ type: "item.delete", itemId }, 1),
      operation({ type: "plan.set-status", itemId, status: "completed" }, 1),
      operation(
        {
          type: "plan.set-checklist-entry",
          itemId,
          entryId: randomUUID(),
          completed: true,
        },
        1
      ),
    ])
      expect(await executeRemoteOperationV4(foreign, command)).toMatchObject({
        kind: "item",
        outcome: { status: "unavailable" },
      })
    expect((await records(foreign)).sequence).toBe(0)
    expect((await records(foreign)).changes).toEqual([])
    expect(
      await executeRemoteOperationV4(
        owner,
        operation(
          {
            type: "plan.set-status",
            itemId: randomUUID(),
            status: "completed",
          },
          1
        )
      )
    ).toMatchObject({ outcome: { status: "unavailable" } })
    const badChecklist = operation(
      {
        type: "plan.set-checklist-entry",
        itemId,
        entryId: randomUUID(),
        completed: true,
      },
      1
    )
    const rejected = await executeRemoteOperationV4(owner, badChecklist)
    expect(rejected).toMatchObject({ outcome: { status: "invalid_command" } })
    expect(await executeRemoteOperationV4(owner, badChecklist)).toEqual(
      rejected
    )
    expect(
      (await (await RemoteItemRepository.open(owner)).read(itemId))?.revision
    ).toBe(1)
    await expect(
      executeRemoteOperationV4(owner, { ...create(), actorUserId: foreign })
    ).rejects.toThrow()
  }, 30000)

  test("DST gaps, repeated plans and wrong progress families never mutate content", async () => {
    const owner = randomUUID()
    const input = draft("appointment")
    const invalidTime = create({
      ...input,
      schedule: {
        mode: "timed",
        localStart: "2026-03-29T02:30",
        localEnd: null,
        timeZone: "Europe/Madrid",
      },
    })
    const gap = await executeRemoteOperationV4(owner, invalidTime)
    expect(gap).toMatchObject({ outcome: { status: "invalid_command" } })
    expect(await executeRemoteOperationV4(owner, invalidTime)).toEqual(gap)
    const repeated = create({
      ...input,
      recurrence: {
        frequency: "daily",
        interval: 1,
        anchorDate: "2026-10-10",
        timeZone: "Europe/Madrid",
        end: { type: "never" },
      },
    })
    expect(await executeRemoteOperationV4(owner, repeated)).toMatchObject({
      outcome: { status: "unsupported" },
    })
    expect((await records(owner)).receipts).toBe(1)
    expect((await records(owner)).sequence).toBe(0)
    const saved = await executeRemoteOperationV4(owner, create(input))
    if (saved.kind !== "item" || saved.outcome.status !== "applied")
      throw new Error("Expected applied creation")
    const itemId = saved.outcome.item.id
    expect(
      await executeRemoteOperationV4(
        owner,
        operation(
          {
            type: "task.set-status",
            itemId,
            occurrenceId: null,
            status: "completed",
          },
          1
        )
      )
    ).toMatchObject({ outcome: { status: "invalid_command" } })
    const old = await executeRemoteOperationV4(
      owner,
      operation({
        type: "item.create",
        itemId: randomUUID(),
        input: {
          kind: "task",
          title: "Old simple task",
          description: "",
          scheduledDate: "2026-10-10",
          status: "not_started",
          checklist: [],
          recurrence: null,
        },
      })
    )
    if (old.kind !== "item" || old.outcome.status !== "applied")
      throw new Error("Expected applied task")
    expect(
      await executeRemoteOperationV4(
        owner,
        operation(
          {
            type: "plan.set-status",
            itemId: old.outcome.item.id,
            status: "completed",
          },
          1
        )
      )
    ).toMatchObject({ outcome: { status: "invalid_command" } })
    expect(
      (await (await RemoteItemRepository.open(owner)).read(itemId))?.revision
    ).toBe(1)
    expect((await records(owner)).sequence).toBe(2)
  }, 30000)

  test("late journal failure rolls back plan, counter and receipt before a clean retry", async () => {
    const owner = randomUUID()
    const first = create()
    if (first.command.type !== "item.create")
      throw new Error("Expected creation")
    const itemId = first.command.itemId
    const database = await getDatabase()
    await database.command({
      collMod: COLLECTION_NAMES.syncChanges,
      validator: { sequence: { $lt: 0 } },
      validationLevel: "strict",
      validationAction: "error",
    })
    try {
      await expect(executeRemoteOperationV4(owner, first)).rejects.toThrow()
      expect(
        await (await RemoteItemRepository.open(owner)).read(itemId)
      ).toBeNull()
      expect(await records(owner)).toEqual({
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
    expect(await executeRemoteOperationV4(owner, first)).toMatchObject({
      kind: "item",
      outcome: { status: "applied", sequence: 1 },
    })
    expect((await records(owner)).receipts).toBe(1)
  }, 30000)

  test("legacy task and tag receipts remain exact across generations", async () => {
    const owner = randomUUID()
    const first = create()
    const taskCreate = operation({
      type: "item.create",
      itemId: randomUUID(),
      input: {
        kind: "task",
        title: "Legacy task",
        description: "Preserved identity",
        scheduledDate: "2026-10-10",
        status: "not_started",
        checklist: [],
        recurrence: null,
      },
    })
    const task = await executeRemoteOperationV3(owner, taskCreate)
    expect(await executeRemoteOperationV4(owner, taskCreate)).toEqual(task)
    if (task.kind !== "item" || task.outcome.status !== "applied")
      throw new Error("Expected legacy task creation")
    const progress = operation(
      {
        type: "task.set-status",
        itemId: task.outcome.item.id,
        occurrenceId: null,
        status: "completed",
      },
      1
    )
    const completed = await executeRemoteOperationV4(owner, progress)
    expect(completed).toMatchObject({
      outcome: { status: "applied", item: { status: "completed" } },
    })
    expect(await executeRemoteOperationV3(owner, progress)).toEqual(completed)
    const tag = operation({
      type: "tag.save",
      tagId: randomUUID(),
      input: { name: "Common category", color: "#2563eb", position: 0 },
    })
    const saved = await executeRemoteOperationV4(owner, tag)
    expect(saved).toMatchObject({
      kind: "preference",
      outcome: { status: "applied" },
    })
    expect(await executeRemoteOperationV3(owner, tag)).toEqual(saved)
    expect(await executeRemoteOperationV4(owner, first)).toMatchObject({
      kind: "item",
      outcome: { status: "applied" },
    })
  }, 30000)

  test("common plan assignments replay exactly while old generations and foreign access cannot change them", async () => {
    const owner = randomUUID()
    const foreign = randomUUID()
    const tagId = randomUUID()
    const foreignTagId = randomUUID()
    await executeRemoteOperationV4(
      owner,
      operation({
        type: "tag.save",
        tagId,
        input: { name: "Plan category", color: "#2563eb", position: 0 },
      })
    )
    await executeRemoteOperationV4(
      foreign,
      operation({
        type: "tag.save",
        tagId: foreignTagId,
        input: { name: "Foreign category", color: "#c2410c", position: 0 },
      })
    )
    const saved = await executeRemoteOperationV4(owner, create(draft("note")))
    if (saved.kind !== "item" || saved.outcome.status !== "applied")
      throw new Error("Expected applied plan")
    const itemId = saved.outcome.item.id
    const assignment = operation({
      type: "item-view.set",
      itemId,
      primaryTagId: tagId,
    })
    const before = await records(owner)
    expect(await executeRemoteOperationV3(owner, assignment)).toMatchObject({
      kind: "preference",
      outcome: { status: "unsupported" },
    })
    expect(await records(owner)).toEqual(before)
    const assigned = await executeRemoteOperationV4(owner, assignment)
    expect(assigned).toMatchObject({
      kind: "preference",
      outcome: {
        status: "applied",
        effects: {
          effects: [
            {
              store: "itemViews",
              record: {
                itemId,
                userId: owner,
                primaryTagId: tagId,
                revision: 1,
              },
            },
          ],
        },
      },
    })
    const repository = await RemoteItemViewRepository.open(owner)
    const current = await repository.read(itemId)
    expect(current?.primaryTagId).toBe(tagId)
    const stable = await records(owner)
    expect(await executeRemoteOperationV4(owner, assignment)).toEqual(assigned)
    expect(await executeRemoteOperationV3(owner, assignment)).toMatchObject({
      kind: "preference",
      outcome: { status: "unsupported" },
    })
    expect(await records(owner)).toEqual(stable)
    expect(
      await executeRemoteOperationV4(
        foreign,
        operation({ type: "item-view.set", itemId, primaryTagId: foreignTagId })
      )
    ).toMatchObject({ outcome: { status: "unavailable" } })
    const wrongCategory = operation(
      { type: "item-view.set", itemId, primaryTagId: foreignTagId },
      1
    )
    const rejected = await executeRemoteOperationV4(owner, wrongCategory)
    expect(rejected).toMatchObject({
      kind: "preference",
      outcome: { status: "invalid_command" },
    })
    expect(await executeRemoteOperationV4(owner, wrongCategory)).toEqual(
      rejected
    )
    expect(await repository.read(itemId)).toEqual(current)
    expect((await records(owner)).sequence).toBe(stable.sequence)
    expect(
      await (await RemoteItemViewRepository.open(foreign)).read(itemId)
    ).toBeNull()
  }, 30000)
})
