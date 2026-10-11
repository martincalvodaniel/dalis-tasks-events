import { expect, test } from "bun:test"
import { diagnosePersonalQueue } from "@/lib/sync/personal-queue-diagnostics"
import { summarizeSyncQueueV2 } from "@/lib/sync/queue-summary-v2"
import {
  readRecurringSyncCommandCapability,
  recurringSyncCapabilityPolicy,
  recurringSyncCapabilityRegistry,
} from "@/lib/sync/recurring-sync-capabilities"
import {
  planSyncCapabilityPolicy,
  readPlanSyncCommandCapability,
} from "@/lib/sync/sync-capabilities"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import { planSchema } from "@/schemas/plan-item"
import type { OutboxEntry } from "@/types/local-sync"
import type { SyncCommand } from "@/types/sync"

const actor = "future-policy-fixture",
  now = "2026-10-11T09:00:00.000Z"
function series() {
  return planSchema.parse({
    kind: "plan",
    variant: "task",
    id: crypto.randomUUID(),
    ownerId: actor,
    title: "Own series",
    description: "",
    status: "not_started",
    checklist: [],
    completedAt: null,
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
    revision: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
}
function entry(
  command: SyncCommand,
  sequence: number,
  dependencies: string[] = []
): OutboxEntry {
  const entityKey =
    command.type === "task.move"
      ? taskPlacementEntityKey(
          command.occurrenceId ?? command.itemId,
          command.scope,
          command.date
        )
      : command.type === "item-view.set"
        ? `item-view:${command.itemId}`
        : "itemId" in command
          ? `item:${command.itemId}`
          : ""
  return {
    userId: actor,
    entityKey,
    sequence,
    dependencies,
    state: "pending",
    attempts: 0,
    createdAt: now,
    lease: null,
    operation: {
      protocolVersion: 1,
      operationId: crypto.randomUUID(),
      baseRevision: 0,
      command,
    },
  }
}

test("prepared recurrence policy admits common series and canonical appearances without widening generation four", () => {
  for (const variant of ["task", "event", "appointment", "note"] as const) {
    const parent = { ...series(), variant },
      slot = `${parent.id}:2026-10-11T09:30`
    const commands: SyncCommand[] = [
      {
        type: "plan.set-occurrence-status",
        itemId: parent.id,
        occurrenceId: slot,
        expectedOccurrenceRevision: 0,
        status: "in_progress",
      },
      {
        type: "plan.set-occurrence-checklist-entry",
        itemId: parent.id,
        occurrenceId: slot,
        expectedOccurrenceRevision: 3,
        entryId: crypto.randomUUID(),
        completed: true,
      },
      {
        type: "plan.update-occurrence",
        itemId: parent.id,
        occurrenceId: slot,
        expectedOccurrenceRevision: 5,
        input: {
          title: "Own",
          description: "",
          checklist: [],
          schedule: parent.schedule,
        },
      },
      {
        type: "plan.cancel-occurrence",
        itemId: parent.id,
        occurrenceId: slot,
        expectedOccurrenceRevision: 7,
      },
      {
        type: "task.move",
        itemId: parent.id,
        occurrenceId: slot,
        scope: "overdue",
        date: "2026-10-11",
        tagId: null,
        beforeId: null,
        afterId: null,
      },
      { type: "item-view.set", itemId: parent.id, primaryTagId: null },
    ]
    const before = structuredClone({ parent, commands })
    for (const command of commands) {
      const future = readRecurringSyncCommandCapability(command, parent)
      expect(future.supported).toBe(true)
      expect(future.requiresRemoteValidation).toBe(true)
      expect(readPlanSyncCommandCapability(command, parent).supported).toBe(
        false
      )
    }
    expect(
      readRecurringSyncCommandCapability(commands[0], parent)
    ).toMatchObject({ kind: "plan-occurrence", store: "occurrences" })
    expect({ parent, commands }).toEqual(before)
    for (const type of ["item.create", "item.update"] as const) {
      const {
        id: _id,
        ownerId: _owner,
        revision: _rev,
        createdAt: _created,
        updatedAt: _updated,
        deletedAt: _deleted,
        completedAt: _completed,
        ...input
      } = parent
      expect(
        readRecurringSyncCommandCapability(
          { type, itemId: parent.id, input },
          parent
        ).supported
      ).toBe(true)
    }
  }
  expect(recurringSyncCapabilityPolicy.stores).toContain("occurrences")
  expect(planSyncCapabilityPolicy.stores).not.toContain("occurrences")
  for (const object of [
    recurringSyncCapabilityPolicy,
    recurringSyncCapabilityRegistry,
    recurringSyncCapabilityRegistry.commands,
    recurringSyncCapabilityRegistry.commands["plan.cancel-occurrence"],
    recurringSyncCapabilityRegistry.stores,
  ])
    expect(Object.isFrozen(object)).toBe(true)
})

test("missing CAS, foreign or invalid slots and unknown parents remain unsupported without rewriting history", () => {
  const parent = series(),
    historical: SyncCommand = {
      type: "plan.cancel-occurrence",
      itemId: parent.id,
      occurrenceId: `${parent.id}:2026-10-11`,
    }
  const before = structuredClone(historical)
  expect(readRecurringSyncCommandCapability(historical, parent)).toMatchObject({
    supported: false,
    reason: "occurrence_revision_missing",
  })
  const durable = { ...historical, expectedOccurrenceRevision: 0 }
  expect(readRecurringSyncCommandCapability(durable).supported).toBe(false)
  for (const occurrenceId of [
    `${crypto.randomUUID()}:2026-10-11`,
    `${parent.id}:2026-02-30`,
    `${parent.id}:2026-10-11T25:30`,
  ])
    expect(
      readRecurringSyncCommandCapability({ ...durable, occurrenceId }, parent)
        .supported
    ).toBe(false)
  expect(() =>
    readRecurringSyncCommandCapability(durable, {
      ...parent,
      id: crypto.randomUUID(),
    })
  ).toThrow()
  // Current rules or a soft deletion cannot prevent a previously committed operation from replaying.
  expect(
    readRecurringSyncCommandCapability(durable, {
      ...parent,
      recurrence: null,
      deletedAt: now,
    }).supported
  ).toBe(true)
  expect(historical).toEqual(before)
})

test("root progress, missing occurrence movement, legacy recurrence and unsupported families stay gated", () => {
  const parent = series()
  for (const command of [
    { type: "plan.set-status", itemId: parent.id, status: "in_progress" },
    {
      type: "plan.set-checklist-entry",
      itemId: parent.id,
      entryId: crypto.randomUUID(),
      completed: true,
    },
    {
      type: "task.set-status",
      itemId: parent.id,
      occurrenceId: null,
      status: "completed",
    },
    {
      type: "task.move",
      itemId: parent.id,
      occurrenceId: null,
      scope: "day",
      date: "2026-10-11",
      tagId: null,
      beforeId: null,
      afterId: null,
    },
  ])
    expect(readRecurringSyncCommandCapability(command, parent).supported).toBe(
      false
    )
  const task = {
    id: parent.id,
    ownerId: actor,
    kind: "task",
    title: "Legacy",
    description: "",
    status: "not_started",
    checklist: [],
    completedAt: null,
    scheduledDate: "2026-10-11",
    recurrence: parent.recurrence,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  expect(
    readRecurringSyncCommandCapability(
      { type: "item.delete", itemId: parent.id },
      task
    ).reason
  ).toBe("recurrence_unavailable")
  expect(
    readRecurringSyncCommandCapability(
      {
        type: "task.cancel-occurrence",
        itemId: parent.id,
        occurrenceId: `${parent.id}:2026-10-11`,
      },
      task
    ).supported
  ).toBe(false)
  expect(
    readRecurringSyncCommandCapability(
      { type: "plan.set-status", itemId: parent.id, status: "in_progress" },
      { ...parent, recurrence: null }
    ).supported
  ).toBe(true)
})

test("future diagnostics release only supported dependency chains while preserving original intentions", () => {
  const parent = series(),
    slot = `${parent.id}:2026-10-11`
  const historical = entry(
    { type: "plan.cancel-occurrence", itemId: parent.id, occurrenceId: slot },
    1
  )
  const dependent = entry(
    { type: "item-view.set", itemId: parent.id, primaryTagId: null },
    2,
    [historical.operation.operationId]
  )
  const supported = entry(
    {
      type: "plan.set-occurrence-status",
      itemId: parent.id,
      occurrenceId: slot,
      expectedOccurrenceRevision: 0,
      status: "completed",
    },
    3
  )
  const movement = entry(
    {
      type: "task.move",
      itemId: parent.id,
      occurrenceId: slot,
      scope: "day",
      date: "2026-10-11",
      tagId: null,
      beforeId: null,
      afterId: null,
    },
    4,
    [supported.operation.operationId]
  )
  const snapshot = {
      userId: actor,
      items: [parent],
      entries: [historical, dependent, supported, movement],
    },
    before = structuredClone(snapshot)
  const future = diagnosePersonalQueue(snapshot, recurringSyncCapabilityPolicy)
  expect(future.operations.map((op) => op.category)).toEqual([
    "unsupported",
    "blocked",
    "ready",
    "waiting",
  ])
  expect(future.personalProjectionBlockers).toEqual([dependent, movement])
  expect(future.ready[0].capability.kind).toBe("plan-occurrence")
  expect(
    summarizeSyncQueueV2(snapshot, recurringSyncCapabilityPolicy)
  ).toMatchObject({
    pending: 4,
    ready: 1,
    unsupported: 1,
    blocked: 1,
    waiting: 1,
  })
  expect(diagnosePersonalQueue(snapshot).ready).toEqual([])
  expect(snapshot).toEqual(before)
})
