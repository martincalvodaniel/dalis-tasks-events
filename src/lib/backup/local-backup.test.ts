import { expect, test } from "bun:test"
import {
  decodeLocalBackup,
  encodeLocalBackup,
  maximumBackupBytes,
  validateLocalBackup,
} from "@/lib/backup/local-backup"
import { applyItemCommand } from "@/lib/calendar/item-command"
import { projectSyncIncident } from "@/lib/sync/incident-projection"
import { planSyncIncidentResolution } from "@/lib/sync/incident-resolution"
import type { LocalBackupV1, LocalBackupV2 } from "@/types/local-backup"
import type { LocalPreferenceOutcomeV2 } from "@/types/local-operation-outcome-v2"
import type { OutboxEntry } from "@/types/local-sync"

function fixture(remoteDeleted = true): LocalBackupV1 {
  const now = "2026-10-08T00:00:00.000Z"
  const userId = "backup-test"
  const draft = {
    kind: "task" as const,
    title: "Preserved task",
    description: "",
    scheduledDate: "2026-10-08",
    status: "in_progress" as const,
    checklist: [],
    recurrence: null,
  }
  const operation = {
    operationId: crypto.randomUUID(),
    protocolVersion: 1 as const,
    baseRevision: 0,
    command: {
      type: "item.create" as const,
      itemId: crypto.randomUUID(),
      input: draft,
    },
  }
  const local = applyItemCommand(null, operation.command, userId, now)
  const remote = {
    ...local,
    title: "Remote task",
    revision: 1,
    deletedAt: remoteDeleted ? now : null,
  }
  const entry: OutboxEntry = {
    userId,
    entityKey: `item:${local.id}`,
    operation,
    sequence: 1,
    dependencies: [],
    state: "conflict",
    attempts: 1,
    lease: null,
    createdAt: now,
  }
  const outcome = {
    key: `operation-outcome:${operation.operationId}`,
    operation,
    result: {
      status: "conflict" as const,
      operationId: operation.operationId,
      current: remote,
    },
    local,
    base: remote,
  }
  const expected = {
    ...projectSyncIncident({ userId, local, remote, entry, outcome }),
    intentions: [entry],
    blockedByRelatedIntentions: false,
  }
  const resolution = planSyncIncidentResolution(
    {
      userId,
      resolutionId: crypto.randomUUID(),
      operationId: null,
      choice: "adopt_remote",
      createdAt: now,
      expected,
    },
    expected
  )
  const nextOperation = {
    ...operation,
    operationId: crypto.randomUUID(),
    command: { ...operation.command, itemId: crypto.randomUUID() },
  }
  const next: OutboxEntry = {
    ...entry,
    operation: nextOperation,
    sequence: 2,
    state: "sending",
    attempts: 1,
    lease: {
      ownerId: crypto.randomUUID(),
      expiresAt: "2026-10-08T00:02:00.000Z",
    },
  }
  next.entityKey = `item:${nextOperation.command.itemId}`
  const nextItem = applyItemCommand(null, nextOperation.command, userId, now)
  const tagId = crypto.randomUUID()
  return {
    format: "dalis-local-backup",
    version: 1,
    protocolVersion: 1,
    databaseVersion: 2,
    userId,
    exportedAt: now,
    stores: {
      items: [resolution.local, nextItem],
      occurrences: [],
      tags: [
        {
          id: tagId,
          userId,
          name: "Personal",
          normalizedName: "personal",
          color: "#00aa99",
          position: 0,
          revision: 0,
          createdAt: now,
          updatedAt: now,
          deletedAt: now,
        },
      ],
      itemViews: [
        {
          userId,
          itemId: nextItem.id,
          primaryTagId: tagId,
          revision: 0,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ],
      taskPlacements: [],
      settings: [
        {
          userId,
          timeZone: "Europe/Madrid",
          weekStartsOn: 1,
          locale: "es-ES",
          revision: 0,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ],
      memberships: [],
      invitations: [],
      outbox: [{ ...entry, state: "superseded" }, next],
      remoteShadows: [{ entityKey: entry.entityKey, record: remote }],
      syncMetadata: [
        outcome,
        resolution,
        { key: "outbox-sequence", value: 2 },
        { key: "pull-cursor", after: 1, through: 3 },
      ],
    },
  }
}
test("portable backups preserve all stores, tombstones, leases and decision evidence without mutating input", () => {
  const backup = fixture()
  const before = JSON.stringify(backup)
  const json = encodeLocalBackup(backup, backup.userId)
  expect(decodeLocalBackup(json, backup.userId)).toEqual(backup)
  expect(JSON.stringify(backup)).toBe(before)
  const copy = decodeLocalBackup(json, backup.userId)
  expect(copy.stores.outbox[0].state).toBe("superseded")
  expect(copy.stores.outbox[1].lease).toEqual(backup.stores.outbox[1].lease)
  expect(copy.stores.items[0].deletedAt).not.toBeNull()
})
test("backup validation rejects foreign, incompatible or partial data and duplicate identities", () => {
  const backup = fixture()
  expect(() => validateLocalBackup(backup, "other")).toThrow("another account")
  for (const key of ["version", "protocolVersion", "databaseVersion"])
    expect(() =>
      validateLocalBackup({ ...backup, [key]: 99 }, backup.userId)
    ).toThrow()
  expect(() =>
    validateLocalBackup({ ...backup, secret: "invalid" }, backup.userId)
  ).toThrow()
  expect(() =>
    validateLocalBackup(
      { ...backup, stores: { ...backup.stores, items: undefined } },
      backup.userId
    )
  ).toThrow()
  for (const mutate of [
    (b: LocalBackupV1) => {
      b.stores.tags[0].userId = "other"
    },
    (b: LocalBackupV1) => {
      b.stores.items[0].ownerId = "other"
    },
    (b: LocalBackupV1) => {
      b.stores.items.push(b.stores.items[0])
    },
    (b: LocalBackupV1) => {
      b.stores.outbox[1].sequence = 1
    },
    (b: LocalBackupV1) => {
      b.stores.outbox[1].dependencies = [crypto.randomUUID()]
    },
    (b: LocalBackupV1) => {
      b.stores.outbox[0].dependencies = [
        b.stores.outbox[1].operation.operationId,
      ]
    },
    (b: LocalBackupV1) => {
      b.stores.syncMetadata = b.stores.syncMetadata.filter(
        (m) => m.key !== "outbox-sequence"
      )
    },
    (b: LocalBackupV1) => {
      b.stores.syncMetadata = b.stores.syncMetadata.filter(
        (m) => !("resolutionId" in m)
      )
    },
    (b: LocalBackupV1) => {
      b.stores.syncMetadata = b.stores.syncMetadata.filter(
        (m) => !("result" in m)
      )
    },
    (b: LocalBackupV1) => {
      b.stores.outbox[1].state = "acknowledged"
      b.stores.outbox[1].lease = null
    },
  ]) {
    const changed = structuredClone(backup)
    mutate(changed)
    expect(() => validateLocalBackup(changed, backup.userId)).toThrow()
  }
})
test("backup decoding bounds bytes before JSON parsing and rejects unknown metadata", () => {
  const backup = fixture()
  expect(() =>
    decodeLocalBackup(" ".repeat(maximumBackupBytes + 1), backup.userId)
  ).toThrow("size limit")
  expect(() =>
    decodeLocalBackup(
      '"'.concat("ñ".repeat(maximumBackupBytes / 2), '"'),
      backup.userId
    )
  ).toThrow("size limit")
  expect(() => decodeLocalBackup("{", backup.userId)).toThrow()
  expect(() =>
    validateLocalBackup(
      {
        ...backup,
        stores: {
          ...backup.stores,
          syncMetadata: [
            ...backup.stores.syncMetadata,
            { key: "unknown", token: "invalid" },
          ],
        },
      },
      backup.userId
    )
  ).toThrow()
})

test("backup evidence rejects another item identity, nested foreign actors and stale counters", () => {
  const backup = fixture()
  for (const mutate of [
    (b: LocalBackupV1) => {
      const outcome = b.stores.syncMetadata.find((m) => "result" in m)
      if (outcome && "result" in outcome && outcome.local)
        outcome.local.id = crypto.randomUUID()
    },
    (b: LocalBackupV1) => {
      const outcome = b.stores.syncMetadata.find((m) => "result" in m)
      if (
        outcome &&
        "result" in outcome &&
        outcome.result.status === "conflict"
      )
        outcome.result.current.id = crypto.randomUUID()
    },
    (b: LocalBackupV1) => {
      const decision = b.stores.syncMetadata.find((m) => "resolutionId" in m)
      if (decision && "resolutionId" in decision)
        decision.expected.intentions[0].userId = "other"
    },
    (b: LocalBackupV1) => {
      const sequence = b.stores.syncMetadata.find(
        (m) => m.key === "outbox-sequence"
      )
      if (sequence && "value" in sequence) sequence.value = 0
    },
    (b: LocalBackupV1) => {
      b.stores.remoteShadows.push(b.stores.remoteShadows[0])
    },
  ]) {
    const changed = structuredClone(backup)
    mutate(changed)
    expect(() => validateLocalBackup(changed, backup.userId)).toThrow()
  }
})

test("a resolution replacement must match the preserved operation payload exactly", () => {
  const backup = fixture(false)
  const decision = backup.stores.syncMetadata.find((m) => "resolutionId" in m)
  if (!decision || !("resolutionId" in decision))
    throw new Error("Fixture decision missing")
  // A live remote permits a fresh retry; build the decision through the planner.
  const remote = { ...decision.expected.remote, deletedAt: null }
  const expected = { ...decision.expected, remote }
  const planned = planSyncIncidentResolution(
    {
      userId: backup.userId,
      resolutionId: crypto.randomUUID(),
      operationId: crypto.randomUUID(),
      copyItemId: null,
      choice: "retry_local",
      createdAt: backup.exportedAt,
      expected,
    },
    expected
  )
  if (!planned.replacement) throw new Error("Fixture replacement missing")
  backup.stores.syncMetadata = backup.stores.syncMetadata.filter(
    (m) => !("resolutionId" in m)
  )
  backup.stores.syncMetadata.push(planned)
  backup.stores.outbox.push({
    ...backup.stores.outbox[1],
    operation: structuredClone(planned.replacement),
    entityKey: backup.stores.outbox[0].entityKey,
    sequence: 3,
    state: "pending",
    attempts: 0,
    lease: null,
  })
  const sequence = backup.stores.syncMetadata.find(
    (m) => m.key === "outbox-sequence"
  )
  if (sequence && "value" in sequence) sequence.value = 3
  expect(() => validateLocalBackup(backup, backup.userId)).not.toThrow()
  const replacement = backup.stores.outbox[2]
  if (replacement.operation.command.type !== "item.update")
    throw new Error("Fixture update missing")
  replacement.operation.command.input.title = "Altered command"
  expect(() => validateLocalBackup(backup, backup.userId)).toThrow(
    "exact replacement"
  )
})

function mixedFixture(): LocalBackupV2 {
  const legacy = fixture()
  const operationId = crypto.randomUUID()
  const tagId = legacy.stores.tags[0].id
  const neighborId = crypto.randomUUID()
  const effects = [
    {
      store: "tags" as const,
      record: { ...legacy.stores.tags[0], revision: 2 },
    },
    {
      store: "tags" as const,
      record: {
        ...legacy.stores.tags[0],
        id: neighborId,
        revision: 8,
        deletedAt: null,
      },
    },
  ]
  const operation = {
    operationId,
    protocolVersion: 1 as const,
    baseRevision: 1,
    command: {
      type: "tag.move" as const,
      tagId,
      beforeId: neighborId,
      afterId: null,
    },
  }
  const outcome: LocalPreferenceOutcomeV2 = {
    version: 2,
    kind: "preference",
    key: `operation-outcome:${operationId}`,
    operation,
    result: {
      kind: "preference",
      outcome: {
        operationId,
        status: "applied",
        effects: {
          version: 1,
          userId: legacy.userId,
          operationId,
          sequence: 2,
          effects,
        },
      },
    },
    local: effects.map((effect) => ({
      entityKey: `tag:${effect.record.id}`,
      record: { ...effect, record: { ...effect.record, revision: 0 } },
    })),
    base: effects.map((effect) => ({
      entityKey: `tag:${effect.record.id}`,
      record: { ...effect, record: { ...effect.record, revision: 20 } },
    })),
  }
  const pending = {
    ...legacy.stores.outbox[0],
    entityKey: `tag:${tagId}`,
    sequence: 4,
    state: "pending" as const,
    attempts: 0,
    dependencies: [operationId],
    operation: {
      ...operation,
      operationId: crypto.randomUUID(),
      baseRevision: 2,
      command: { type: "tag.delete" as const, tagId },
    },
  }
  const itemOutcome = legacy.stores.syncMetadata.find(
    (record) => "result" in record
  )
  if (!itemOutcome || !("result" in itemOutcome))
    throw new Error("Expected legacy outcome")
  return {
    ...legacy,
    version: 2,
    stores: {
      ...legacy.stores,
      outbox: [
        ...legacy.stores.outbox,
        {
          ...legacy.stores.outbox[0],
          entityKey: `tag:${tagId}`,
          sequence: 3,
          state: "acknowledged",
          operation: structuredClone(operation),
        },
        pending,
      ],
      remoteShadows: [
        ...legacy.stores.remoteShadows,
        ...effects.map((effect) => ({
          version: 2 as const,
          kind: "preference" as const,
          entityKey: `tag:${effect.record.id}`,
          record: { ...effect, record: { ...effect.record, revision: 20 } },
        })),
      ],
      syncMetadata: [
        ...legacy.stores.syncMetadata.filter(
          (record) => record.key !== "outbox-sequence"
        ),
        outcome,
        { key: "outbox-sequence", value: 4 },
        { key: "preference-tail", operationId: pending.operation.operationId },
      ],
    },
  }
}

function personalOutcome(backup: LocalBackupV2): LocalPreferenceOutcomeV2 {
  for (const record of backup.stores.syncMetadata)
    if ("kind" in record && record.kind === "preference") return record
  throw new Error("Expected personal outcome")
}

test("portable two roundtrips mixed exact histories, independent revisions, tombstones and an older replay", () => {
  const backup = mixedFixture()
  const before = JSON.stringify(backup)
  const value = decodeLocalBackup(
    encodeLocalBackup(backup, backup.userId),
    backup.userId
  )
  expect(value).toEqual(backup)
  expect(value.version).toBe(2)
  expect(value.protocolVersion).toBe(1)
  if (value.version !== 2) throw new Error("Expected portable two")
  const outcome = personalOutcome(value)
  expect(outcome.base.map((entry) => entry.record?.record.revision)).toEqual([
    20, 20,
  ])
  expect(outcome.local.map((entry) => entry.record?.record.revision)).toEqual([
    0, 0,
  ])
  if (outcome.result.outcome.status !== "applied")
    throw new Error("Expected applied effects")
  expect(
    outcome.result.outcome.effects.effects.map(
      (effect) => effect.record.revision
    )
  ).toEqual([2, 8])
  expect(
    outcome.result.outcome.effects.effects[0].record.deletedAt
  ).not.toBeNull()
  expect(value.stores.outbox[3].dependencies).toEqual([
    outcome.operation.operationId,
  ])
  expect(
    value.stores.syncMetadata.find((record) => record.key === "preference-tail")
  ).toEqual(backup.stores.syncMetadata.at(-1))
  expect(value.stores.remoteShadows[0]).toEqual(backup.stores.remoteShadows[0])
  outcome.operation.baseRevision = 30
  expect(JSON.stringify(backup)).toBe(before)
})

test("portable two can preserve item two beside legacy shadows without normalizing exported history", () => {
  const backup = mixedFixture()
  backup.stores.syncMetadata = backup.stores.syncMetadata.map((record) =>
    "result" in record && !("version" in record)
      ? {
          ...record,
          version: 2,
          kind: "item",
          result: { kind: "item", outcome: record.result },
        }
      : record
  )
  const first = backup.stores.remoteShadows[0]
  if ("kind" in first) throw new Error("Expected legacy shadow")
  backup.stores.remoteShadows[0] = {
    ...first,
    version: 2,
    kind: "item",
  }
  expect(
    decodeLocalBackup(encodeLocalBackup(backup, backup.userId), backup.userId)
  ).toEqual(backup)
  expect(() =>
    validateLocalBackup({ ...backup, version: 1 }, backup.userId)
  ).toThrow()
})

test("portable two rejects forged ACKs, family or target substitutions and partial preference evidence", () => {
  for (const mutation of [
    "missing",
    "wrong-intention",
    "wrong-family",
    "wrong-target",
    "missing-snapshot",
    "zero-base",
    "foreign",
    "forged-ack",
  ] as const) {
    const backup = mixedFixture()
    const outcome = personalOutcome(backup)
    if (mutation === "missing")
      backup.stores.syncMetadata = backup.stores.syncMetadata.filter(
        (record) => record.key !== outcome.key
      )
    if (mutation === "wrong-intention") outcome.operation.baseRevision = 100
    if (mutation === "wrong-family") {
      outcome.operation.command = {
        type: "item.delete",
        itemId: crypto.randomUUID(),
      }
      backup.stores.outbox[2].operation = outcome.operation
      backup.stores.outbox[2].entityKey = `item:${outcome.operation.command.itemId}`
    }
    if (
      mutation === "wrong-target" &&
      outcome.result.outcome.status === "applied"
    ) {
      const effect = outcome.result.outcome.effects.effects[0]
      if (effect.store !== "tags") throw new Error("Expected tag effect")
      effect.record.id = crypto.randomUUID()
    }
    if (mutation === "missing-snapshot") outcome.local.pop()
    if (mutation === "zero-base" && outcome.base[0].record)
      outcome.base[0].record.record.revision = 0
    if (mutation === "foreign" && outcome.local[0].record)
      outcome.local[0].record.record.userId = "foreign"
    if (mutation === "forged-ack") {
      outcome.result.outcome = {
        operationId: outcome.operation.operationId,
        status: "unsupported",
      }
      outcome.local = [outcome.local[0]]
      outcome.base = [outcome.base[0]]
    }
    expect(() => validateLocalBackup(backup, backup.userId)).toThrow()
  }
})

test("portable two retains conflict and error absence while rejecting duplicate, future and corrupt graph evidence", () => {
  for (const status of [
    "conflict",
    "invalid_command",
    "unavailable",
    "identity_reuse",
  ] as const) {
    const backup = mixedFixture()
    const outcome = personalOutcome(backup)
    if (outcome.result.outcome.status !== "applied")
      throw new Error("Expected effects")
    const current = outcome.result.outcome.effects.effects[0]
    outcome.result.outcome =
      status === "conflict"
        ? { operationId: outcome.operation.operationId, status, current }
        : { operationId: outcome.operation.operationId, status }
    outcome.local = [{ entityKey: outcome.local[0].entityKey, record: null }]
    outcome.base = [outcome.base[0]]
    backup.stores.outbox[2].state =
      status === "conflict" ? "conflict" : "rejected"
    expect(validateLocalBackup(backup, backup.userId)).toEqual(backup)
    backup.stores.outbox[2].state = "acknowledged"
    expect(() => validateLocalBackup(backup, backup.userId)).toThrow(
      "durable operation evidence"
    )
  }
  const backup = mixedFixture()
  for (const change of [
    { ...backup, version: 3 },
    { ...backup, extra: true },
    {
      ...backup,
      stores: {
        ...backup.stores,
        remoteShadows: [
          ...backup.stores.remoteShadows,
          backup.stores.remoteShadows[1],
        ],
      },
    },
    {
      ...backup,
      stores: {
        ...backup.stores,
        syncMetadata: [...backup.stores.syncMetadata, personalOutcome(backup)],
      },
    },
    {
      ...backup,
      stores: {
        ...backup.stores,
        remoteShadows: [{ ...backup.stores.remoteShadows[1], version: 3 }],
      },
    },
  ])
    expect(() => validateLocalBackup(change, backup.userId)).toThrow()
  for (const mutation of ["sequence", "dependencies", "tail"] as const) {
    const changed = structuredClone(backup)
    if (mutation === "sequence") changed.stores.outbox[3].sequence = 3
    if (mutation === "dependencies")
      changed.stores.outbox[3].dependencies = [crypto.randomUUID()]
    if (mutation === "tail") {
      const tail = changed.stores.syncMetadata.find(
        (record) => record.key === "preference-tail"
      )
      if (!tail || !("operationId" in tail)) throw new Error("Expected tail")
      tail.operationId = crypto.randomUUID()
    }
    expect(() => validateLocalBackup(changed, backup.userId)).toThrow()
  }
})
