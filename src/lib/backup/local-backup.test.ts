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
import type { LocalBackup } from "@/types/local-backup"
import type { OutboxEntry } from "@/types/local-sync"

function fixture(remoteDeleted = true): LocalBackup {
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
    (b: LocalBackup) => {
      b.stores.tags[0].userId = "other"
    },
    (b: LocalBackup) => {
      b.stores.items[0].ownerId = "other"
    },
    (b: LocalBackup) => {
      b.stores.items.push(b.stores.items[0])
    },
    (b: LocalBackup) => {
      b.stores.outbox[1].sequence = 1
    },
    (b: LocalBackup) => {
      b.stores.outbox[1].dependencies = [crypto.randomUUID()]
    },
    (b: LocalBackup) => {
      b.stores.outbox[0].dependencies = [
        b.stores.outbox[1].operation.operationId,
      ]
    },
    (b: LocalBackup) => {
      b.stores.syncMetadata = b.stores.syncMetadata.filter(
        (m) => m.key !== "outbox-sequence"
      )
    },
    (b: LocalBackup) => {
      b.stores.syncMetadata = b.stores.syncMetadata.filter(
        (m) => !("resolutionId" in m)
      )
    },
    (b: LocalBackup) => {
      b.stores.syncMetadata = b.stores.syncMetadata.filter(
        (m) => !("result" in m)
      )
    },
    (b: LocalBackup) => {
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
    (b: LocalBackup) => {
      const outcome = b.stores.syncMetadata.find((m) => "result" in m)
      if (outcome && "result" in outcome && outcome.local)
        outcome.local.id = crypto.randomUUID()
    },
    (b: LocalBackup) => {
      const outcome = b.stores.syncMetadata.find((m) => "result" in m)
      if (
        outcome &&
        "result" in outcome &&
        outcome.result.status === "conflict"
      )
        outcome.result.current.id = crypto.randomUUID()
    },
    (b: LocalBackup) => {
      const decision = b.stores.syncMetadata.find((m) => "resolutionId" in m)
      if (decision && "resolutionId" in decision)
        decision.expected.intentions[0].userId = "other"
    },
    (b: LocalBackup) => {
      const sequence = b.stores.syncMetadata.find(
        (m) => m.key === "outbox-sequence"
      )
      if (sequence && "value" in sequence) sequence.value = 0
    },
    (b: LocalBackup) => {
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
