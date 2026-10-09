import { expect, test } from "bun:test"
import { planLocalPreferenceResult } from "@/lib/sync/preference-result-plan"
import {
  overduePlacementDate,
  taskPlacementEntityKey,
} from "@/schemas/ordering"
import { personalShadowEntityKey } from "@/schemas/remote-shadow-v2"
import type { OutboxEntry } from "@/types/local-sync"
import type { LocalSyncResultInputV2 } from "@/types/local-sync-result-v2"
import type { PersonalSnapshot } from "@/types/personal-snapshot"
import type { PreferenceEffect } from "@/types/preference-effects"
import type { RemoteShadowV2 } from "@/types/remote-shadow-v2"
import type { SyncCommand } from "@/types/sync"

const userId = "preference-result-plan-owner"
const timestamp = "2026-10-08T00:00:00.000Z"
function tag(
  id: string,
  revision: number
): Extract<PreferenceEffect, { store: "tags" }> {
  return {
    store: "tags",
    record: {
      id,
      userId,
      name: "Observed",
      normalizedName: "observed",
      color: "#123456",
      position: 1024,
      revision,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    },
  }
}
function fixture() {
  const id = crypto.randomUUID()
  const neighbor = crypto.randomUUID()
  const operationId = crypto.randomUUID()
  const senderId = crypto.randomUUID()
  const operation = {
    operationId,
    protocolVersion: 1 as const,
    baseRevision: 1,
    command: {
      type: "tag.move" as const,
      tagId: id,
      beforeId: neighbor,
      afterId: null,
    },
  }
  const entry: OutboxEntry = {
    userId,
    operation,
    entityKey: `tag:${id}`,
    sequence: 1,
    dependencies: [],
    state: "sending",
    attempts: 1,
    createdAt: timestamp,
    lease: { ownerId: senderId, expiresAt: "2026-10-08T00:01:00.000Z" },
  }
  const effects = [tag(id, 2), tag(neighbor, 8)]
  const submission: Omit<LocalSyncResultInputV2, "result"> & {
    result: Extract<LocalSyncResultInputV2["result"], { kind: "preference" }>
  } = {
    operation,
    senderId,
    result: {
      kind: "preference",
      outcome: {
        operationId,
        status: "applied",
        effects: { version: 1, userId, operationId, sequence: 3, effects },
      },
    },
  }
  const local: PersonalSnapshot = effects.map((effect) => ({
    entityKey: `tag:${effect.record.id}`,
    record: {
      ...effect,
      record: { ...effect.record, revision: 0, position: 7000 },
    },
  }))
  const shadows: RemoteShadowV2[] = effects.map((effect) => ({
    version: 2,
    kind: "preference",
    entityKey: `tag:${effect.record.id}`,
    record: {
      ...effect,
      record: { ...effect.record, revision: 20, position: 20 },
    },
  }))
  return {
    userId,
    submission,
    entries: [entry],
    local,
    shadows,
    existingOutcome: null,
  }
}
function dependent(
  input: ReturnType<typeof fixture>,
  index: number,
  tagId: string,
  attempts = 0
): OutboxEntry {
  return {
    ...input.entries[0],
    sequence: index,
    state: "pending",
    attempts,
    lease: null,
    entityKey: `tag:${tagId}`,
    dependencies: [input.submission.operation.operationId],
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 0,
      command: { type: "tag.delete", tagId },
    },
  }
}

function placementFixture(scope: "day" | "overdue" = "day") {
  const itemId = crypto.randomUUID()
  const peerId = crypto.randomUUID()
  const operationId = crypto.randomUUID()
  const senderId = crypto.randomUUID()
  const operation = {
    operationId,
    protocolVersion: 1 as const,
    baseRevision: 0,
    command: {
      type: "task.move" as const,
      itemId,
      occurrenceId: null,
      scope,
      date: "2026-10-08",
      tagId: null,
      beforeId: peerId,
      afterId: null,
    },
  }
  const effects: PreferenceEffect[] = [
    ...[itemId, peerId].map((occurrenceId, index) => ({
      store: "taskPlacements" as const,
      record: {
        userId,
        occurrenceId,
        scope,
        date:
          scope === "overdue" ? overduePlacementDate : operation.command.date,
        tagId: null,
        position: (index + 1) * 1024,
        revision: index === 0 ? 1 : 8,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      },
    })),
    {
      store: "itemViews",
      record: {
        userId,
        itemId,
        primaryTagId: null,
        revision: 4,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      },
    },
  ]
  const submission: Omit<LocalSyncResultInputV2, "result"> & {
    result: Extract<LocalSyncResultInputV2["result"], { kind: "preference" }>
  } = {
    operation,
    senderId,
    result: {
      kind: "preference",
      outcome: {
        operationId,
        status: "applied",
        effects: { version: 1, userId, operationId, sequence: 9, effects },
      },
    },
  }
  const local: PersonalSnapshot = effects.map((effect) => {
    const record = structuredClone(effect)
    record.record.revision = 0
    return { entityKey: personalShadowEntityKey(effect), record }
  })
  const shadows: Extract<RemoteShadowV2, { kind: "preference" }>[] =
    effects.map((effect) => {
      const record = structuredClone(effect)
      record.record.revision = 20
      return {
        version: 2,
        kind: "preference",
        entityKey: personalShadowEntityKey(effect),
        record,
      }
    })
  const entry: OutboxEntry = {
    userId,
    entityKey: taskPlacementEntityKey(itemId, scope, operation.command.date),
    operation,
    sequence: 1,
    dependencies: [],
    state: "sending",
    attempts: 1,
    createdAt: timestamp,
    lease: { ownerId: senderId, expiresAt: "2026-10-08T00:01:00.000Z" },
  }
  return {
    userId,
    submission,
    local,
    shadows,
    entries: [entry],
    existingOutcome: null,
  }
}

function placementDependent(
  input: ReturnType<typeof placementFixture>,
  sequence: number,
  entityKey: string,
  command: SyncCommand
): OutboxEntry {
  return {
    ...input.entries[0],
    entityKey,
    sequence,
    state: "pending",
    attempts: 0,
    lease: null,
    dependencies: [input.submission.operation.operationId],
    operation: {
      protocolVersion: 1,
      operationId: crypto.randomUUID(),
      baseRevision: 0,
      command,
    },
  }
}

test("ACK rebases only untried direct dependents by each own effect revision and preserves all optimistic personal records", () => {
  const input = fixture()
  const effects = input.submission.result.outcome
  if (effects.status !== "applied") throw new Error("Expected effects")
  const ids = effects.effects.effects.map((effect) =>
    effect.store === "tags" ? effect.record.id : ""
  )
  input.entries.push(
    dependent(input, 2, ids[0]),
    dependent(input, 3, ids[1]),
    dependent(input, 4, ids[1], 1),
    dependent(input, 5, crypto.randomUUID())
  )
  const indirect = dependent(input, 6, ids[0])
  indirect.dependencies = [input.entries[1].operation.operationId]
  input.entries.push(indirect)
  const before = structuredClone(input)
  const plan = planLocalPreferenceResult(input)
  expect(plan.entries.map((entry) => entry.operation.baseRevision)).toEqual([
    1, 2, 8, 0, 0, 0,
  ])
  expect(plan.entries[0].state).toBe("acknowledged")
  expect(plan.entries[0].lease).toBeNull()
  expect(plan.local).toEqual(input.local)
  expect(plan.shadows.map((shadow) => shadow.record.record.revision)).toEqual([
    20, 20,
  ])
  expect(
    plan.outcome.base.map((entry) => entry.record?.record.revision)
  ).toEqual([20, 20])
  expect(plan.outcome.local).toEqual(input.local)
  expect(plan.outcome.result).toEqual(input.submission.result)
  for (let index = 1; index < input.entries.length; index++) {
    expect(plan.entries[index].operation.operationId).toBe(
      input.entries[index].operation.operationId
    )
    expect(plan.entries[index].operation.command).toEqual(
      input.entries[index].operation.command
    )
    expect(plan.entries[index].dependencies).toEqual(
      input.entries[index].dependencies
    )
  }
  expect(input).toEqual(before)
})

test("the final ACK reconciles all personal caches from newer shadows without rewriting an old durable replay", () => {
  const input = fixture()
  const plan = planLocalPreferenceResult(input)
  expect(plan.local.map((entry) => entry.record?.record.revision)).toEqual([
    20, 20,
  ])
  expect(
    plan.outcome.local.map((entry) => entry.record?.record.revision)
  ).toEqual([0, 0])
  const replay = {
    ...input,
    entries: plan.entries,
    local: plan.local,
    shadows: plan.shadows,
    existingOutcome: plan.outcome,
    submission: { ...input.submission, senderId: crypto.randomUUID() },
  }
  expect(planLocalPreferenceResult(replay).status).toBe("replayed")
  expect(planLocalPreferenceResult(replay).outcome).toEqual(plan.outcome)
  if (input.submission.result.outcome.status !== "applied")
    throw new Error("Expected effects")
  input.submission.result.outcome.effects.sequence = 99
  expect(() =>
    planLocalPreferenceResult({ ...replay, submission: input.submission })
  ).toThrow("durable outcome")
})

test("conflicts update only their independent shadow and errors preserve pending chains with explicit snapshots", () => {
  for (const status of [
    "conflict",
    "unsupported",
    "unavailable",
    "invalid_command",
    "identity_reuse",
  ] as const) {
    const input = fixture()
    if (input.submission.operation.command.type !== "tag.move")
      throw new Error("Expected movement")
    const current = tag(input.submission.operation.command.tagId, 21)
    input.submission.result = {
      kind: "preference",
      outcome:
        status === "conflict"
          ? {
              operationId: input.submission.operation.operationId,
              status,
              current,
            }
          : { operationId: input.submission.operation.operationId, status },
    }
    const dependentEntry = dependent(input, 2, current.record.id)
    input.entries.push(dependentEntry)
    const plan = planLocalPreferenceResult(input)
    expect(plan.entries[0].state).toBe(
      status === "conflict"
        ? "conflict"
        : status === "unsupported"
          ? "pending"
          : "rejected"
    )
    expect(plan.entries[0].lease).toBeNull()
    expect(plan.entries[1]).toEqual(dependentEntry)
    expect(plan.local).toEqual(input.local)
    expect(plan.outcome.local).toHaveLength(1)
    expect(plan.outcome.base).toHaveLength(1)
    expect(plan.shadows[0].record.record.revision).toBe(
      status === "conflict" ? 21 : 20
    )
  }
})

test("leases, exact intentions, full queue ownership and same-revision contradictions guard every plan", () => {
  const input = fixture()
  for (const change of [
    {
      ...input,
      submission: { ...input.submission, senderId: crypto.randomUUID() },
    },
    {
      ...input,
      entries: [
        {
          ...input.entries[0],
          operation: { ...input.entries[0].operation, baseRevision: 10 },
        },
      ],
    },
    {
      ...input,
      entries: [{ ...input.entries[0], state: "pending", lease: null }],
    },
    { ...input, entries: [{ ...input.entries[0], userId: "foreign" }] },
    {
      ...input,
      entries: [...input.entries, { ...input.entries[0], sequence: 2 }],
    },
    { ...input, existingOutcome: { version: 3 } },
  ])
    expect(() => planLocalPreferenceResult(change)).toThrow()
  if (input.submission.result.outcome.status !== "applied")
    throw new Error("Expected effects")
  input.submission.result.outcome.effects.effects[0].record.revision = 20
  expect(() => planLocalPreferenceResult(input)).toThrow("same revision")
})

test("unsupported personal stores reject even as unrelated known shadow evidence and no evidence is silently trimmed", () => {
  const input = fixture()
  const unsupported = {
    version: 2,
    kind: "preference",
    entityKey: `settings:${userId}`,
    record: {
      store: "settings",
      record: {
        userId,
        timeZone: "Europe/Madrid",
        locale: "es-ES",
        weekStartsOn: 1,
        revision: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      },
    },
  }
  expect(() =>
    planLocalPreferenceResult({
      ...input,
      shadows: [...input.shadows, unsupported],
    })
  ).toThrow("shadow store")
  expect(() =>
    planLocalPreferenceResult({
      ...input,
      local: Array.from({ length: 10001 }, () => input.local[0]),
    })
  ).toThrow()
  const command = {
    type: "settings.update",
    input: { timeZone: "Europe/Madrid", locale: "es-ES", weekStartsOn: 1 },
  }
  expect(() =>
    planLocalPreferenceResult({
      ...input,
      submission: {
        ...input.submission,
        operation: { ...input.submission.operation, command },
        result: {
          kind: "preference",
          outcome: {
            operationId: input.submission.operation.operationId,
            status: "unsupported",
          },
        },
      },
    })
  ).toThrow("support this command")
})

test("placement ACK preserves the original move and rebases only untried direct dependents using all independent effect revisions", () => {
  const input = placementFixture()
  const command = input.entries[0].operation.command
  if (command.type !== "task.move" || command.beforeId === null)
    throw new Error("Expected move")
  const move = placementDependent(input, 2, input.entries[0].entityKey, command)
  const peer = placementDependent(input, 3, input.local[1].entityKey, {
    ...command,
    itemId: command.beforeId,
    beforeId: null,
  })
  const view = placementDependent(input, 4, input.local[2].entityKey, {
    type: "item-view.set",
    itemId: command.itemId,
    primaryTagId: crypto.randomUUID(),
  })
  const tried = {
    ...peer,
    sequence: 5,
    attempts: 1,
    operation: { ...peer.operation, operationId: crypto.randomUUID() },
  }
  const indirect = {
    ...move,
    sequence: 6,
    dependencies: [move.operation.operationId],
    operation: { ...move.operation, operationId: crypto.randomUUID() },
  }
  const unrelated = {
    ...move,
    sequence: 7,
    dependencies: [],
    operation: { ...move.operation, operationId: crypto.randomUUID() },
  }
  input.entries.push(move, peer, view, tried, indirect, unrelated)
  const before = structuredClone(input)
  const plan = planLocalPreferenceResult(input)
  expect(plan.entries.map((entry) => entry.operation.baseRevision)).toEqual([
    0, 1, 8, 4, 0, 0, 0,
  ])
  expect(plan.entries[0].state).toBe("acknowledged")
  expect(plan.entries[0].operation).toEqual(input.submission.operation)
  expect(plan.entries.slice(4)).toEqual(input.entries.slice(4))
  expect(plan.local).toEqual(input.local)
  expect(plan.outcome.local).toEqual(input.local)
  expect(plan.outcome.base).toEqual(
    input.shadows.map((shadow) => ({
      entityKey: shadow.entityKey,
      record: shadow.kind === "preference" ? shadow.record : null,
    }))
  )
  expect(plan.outcome.result).toEqual(input.submission.result)
  for (let index = 1; index < plan.entries.length; index++) {
    expect(plan.entries[index].operation.command).toEqual(
      input.entries[index].operation.command
    )
    expect(plan.entries[index].operation.operationId).toBe(
      input.entries[index].operation.operationId
    )
    expect(plan.entries[index].dependencies).toEqual(
      input.entries[index].dependencies
    )
  }
  plan.local[0].record = null
  expect(input).toEqual(before)
})

test("overdue placement identity stays canonical while conflicts and document-free errors preserve exact primary evidence", () => {
  for (const status of [
    "conflict",
    "unsupported",
    "invalid_command",
  ] as const) {
    const input = placementFixture("overdue")
    const current = input.shadows[0]
    if (current.kind !== "preference")
      throw new Error("Expected personal shadow")
    const conflict = structuredClone(current.record)
    conflict.record.revision = 21
    input.submission.result = {
      kind: "preference",
      outcome:
        status === "conflict"
          ? {
              operationId: input.submission.operation.operationId,
              status,
              current: conflict,
            }
          : { operationId: input.submission.operation.operationId, status },
    }
    const plan = planLocalPreferenceResult(input)
    expect(plan.outcome.local).toEqual([input.local[0]])
    expect(plan.outcome.base).toEqual([
      { entityKey: current.entityKey, record: current.record },
    ])
    expect(plan.outcome.local[0].entityKey).toContain(overduePlacementDate)
    expect(plan.outcome.local[0].entityKey).not.toContain("tag:null")
    expect(plan.outcome.operation.command).toEqual(
      input.submission.operation.command
    )
    expect(plan.local).toEqual(input.local)
    expect(plan.entries[0].state).toBe(
      status === "conflict"
        ? "conflict"
        : status === "unsupported"
          ? "pending"
          : "rejected"
    )
    expect(plan.shadows[0].record.record.revision).toBe(
      status === "conflict" ? 21 : 20
    )
    expect(plan.shadows.slice(1)).toEqual(input.shadows.slice(1))
  }
  const absent = placementFixture()
  absent.local = []
  absent.shadows = []
  absent.submission.result = {
    kind: "preference",
    outcome: {
      operationId: absent.submission.operation.operationId,
      status: "unavailable",
    },
  }
  const outcome = planLocalPreferenceResult(absent).outcome
  expect(outcome.local).toEqual([
    { entityKey: absent.entries[0].entityKey, record: null },
  ])
  expect(outcome.base).toEqual(outcome.local)
})

test("late placement ACK and exact replay retain newer tombstones and the original independent observed bases", () => {
  const input = placementFixture()
  const primary = input.shadows[0]
  if (primary.kind !== "preference")
    throw new Error("Expected placement shadow")
  primary.record.record.deletedAt = timestamp
  const plan = planLocalPreferenceResult(input)
  expect(plan.local.map((entry) => entry.record?.record.revision)).toEqual([
    20, 20, 20,
  ])
  expect(plan.local[0].record?.record.deletedAt).toBe(timestamp)
  expect(
    plan.outcome.local.map((entry) => entry.record?.record.revision)
  ).toEqual([0, 0, 0])
  expect(plan.outcome.base[0].record?.record.deletedAt).toBe(timestamp)
  const replay = {
    ...input,
    local: plan.local,
    shadows: plan.shadows,
    entries: plan.entries,
    existingOutcome: plan.outcome,
    submission: { ...input.submission, senderId: crypto.randomUUID() },
  }
  const newer = replay.shadows[0]
  newer.record.record.revision = 30
  const result = planLocalPreferenceResult(replay)
  expect(result.status).toBe("replayed")
  expect(result.outcome).toEqual(plan.outcome)
  expect(result.outcome.base[0].record?.record.revision).toBe(20)
  expect(result.shadows[0].record.record.revision).toBe(30)
  expect(result.local).toEqual(replay.local)
  expect(result.entries).toEqual(plan.entries)
})
