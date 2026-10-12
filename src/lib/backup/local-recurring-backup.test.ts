import { expect, test } from "bun:test"
import { planLocalBackupImport } from "@/lib/backup/import-plan"
import { previewLocalBackupImport } from "@/lib/backup/import-preview"
import { buildBackupImportRecord } from "@/lib/backup/import-record"
import {
  decodeLocalRecurringBackup,
  encodeLocalRecurringBackup,
  maximumBackupBytes,
  validateLocalBackup,
  validateLocalRecurringBackup,
} from "@/lib/backup/local-backup"
import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import { planOccurrenceEntityKey } from "@/schemas/local-plan-occurrence-sync"
import { localRecurringBackupV3Schema } from "@/schemas/local-recurring-backup"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"
import type { PlanVariant } from "@/types/plan-item"

const timestamp = "2026-10-11T13:00:00.000Z"
function fixture(variant: PlanVariant = "task") {
  const userId = "recurring-backup-owner",
    id = crypto.randomUUID()
  const series = planSchema.parse({
    kind: "plan",
    variant,
    id,
    ownerId: userId,
    title: "Series",
    description: "",
    status: "not_started",
    completedAt: null,
    checklist: [],
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
    revision: 3,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  })
  const entry = outboxEntrySchema.parse({
    userId,
    entityKey: `item:${id}`,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 3,
      command: {
        type: "plan.set-occurrence-status",
        itemId: id,
        occurrenceId: `${id}:2026-10-11`,
        expectedOccurrenceRevision: 0,
        status: "completed",
      },
    },
    sequence: 1,
    state: "acknowledged",
    attempts: 1,
    lease: null,
    dependencies: [],
    createdAt: timestamp,
  })
  const local = applyPlanOccurrenceCommand(
    series,
    null,
    {
      type: "plan.set-occurrence-status",
      itemId: id,
      occurrenceId: `${id}:2026-10-11`,
      status: "completed",
    },
    userId,
    timestamp
  )
  const committed = { ...local, revision: 1 }
  const pending = outboxEntrySchema.parse({
    ...entry,
    state: "sending",
    sequence: 2,
    attempts: 2,
    lease: {
      ownerId: crypto.randomUUID(),
      expiresAt: "2026-10-11T13:01:00.000Z",
    },
    dependencies: [entry.operation.operationId],
    operation: {
      ...entry.operation,
      operationId: crypto.randomUUID(),
      command: { ...entry.operation.command, occurrenceId: `${id}:2026-10-12` },
    },
  })
  const outcome = {
    version: 2,
    kind: "plan-occurrence",
    key: `operation-outcome:${entry.operation.operationId}`,
    operation: entry.operation,
    result: {
      kind: "plan-occurrence",
      userId,
      outcome: {
        status: "applied",
        operationId: entry.operation.operationId,
        occurrence: committed,
        seriesRevision: 3,
        sequence: 5,
      },
    },
    local,
    base: null,
    series,
  }
  const backup = localRecurringBackupV3Schema.parse({
    format: "dalis-local-backup",
    version: 3,
    protocolVersion: 1,
    databaseVersion: 2,
    userId,
    exportedAt: timestamp,
    stores: {
      items: [series],
      occurrences: [committed],
      tags: [],
      itemViews: [],
      taskPlacements: [],
      settings: [],
      memberships: [],
      invitations: [],
      outbox: [entry, pending],
      remoteShadows: [
        {
          version: 2,
          kind: "plan-occurrence",
          userId,
          entityKey: planOccurrenceEntityKey(committed.id),
          seriesRevision: 3,
          record: committed,
        },
      ],
      syncMetadata: [
        outcome,
        { key: "outbox-sequence", value: 2 },
        { key: "pull-cursor", after: 5, through: 8 },
      ],
    },
  })
  return { backup, series, entry, committed, outcome }
}
test("portable recurring format preserves four variants, exact intentions, evidence, lease and frozen checkpoint", () => {
  for (const variant of ["task", "event", "appointment", "note"] as const) {
    const { backup } = fixture(variant),
      before = structuredClone(backup)
    expect(
      decodeLocalRecurringBackup(
        encodeLocalRecurringBackup(backup, backup.userId),
        backup.userId
      )
    ).toEqual(backup)
    expect(backup).toEqual(before)
    expect(backup.protocolVersion).toBe(1)
    expect(backup.stores.remoteShadows[0]).toMatchObject({ version: 2 })
    expect(() => validateLocalBackup(backup, backup.userId)).toThrow()
  }
})
test("cancelled occurrence, parent tombstone and later observed base remain portable without invented ancestry", () => {
  const { backup, committed } = fixture()
  const later = {
    ...committed,
    revision: 7,
    cancelled: true,
    deletedAt: timestamp,
  }
  backup.stores.items[0].deletedAt = timestamp
  backup.stores.occurrences = [later]
  const shadow = backup.stores.remoteShadows[0]
  if (!("kind" in shadow) || shadow.kind !== "plan-occurrence")
    throw new Error("Appearance fixture is missing")
  shadow.record = later
  const outcome = backup.stores.syncMetadata.find(
    (record) => "kind" in record && record.kind === "plan-occurrence"
  )
  if (!outcome || !("kind" in outcome) || outcome.kind !== "plan-occurrence")
    throw new Error("Outcome fixture is missing")
  outcome.base = later
  expect(
    decodeLocalRecurringBackup(
      encodeLocalRecurringBackup(backup, backup.userId),
      backup.userId
    )
  ).toEqual(backup)
  expect(outcome.result.outcome.status).toBe("applied")
  if (outcome.result.outcome.status === "applied")
    expect(outcome.result.outcome.occurrence.revision).toBe(1)
})
test("conflict with materialized absence stays explicit alongside the pending dependent", () => {
  const { backup, series } = fixture()
  backup.stores.outbox[0].state = "conflict"
  const outcome = backup.stores.syncMetadata.find(
    (record) => "kind" in record && record.kind === "plan-occurrence"
  )
  if (!outcome || !("kind" in outcome) || outcome.kind !== "plan-occurrence")
    throw new Error("Outcome fixture is missing")
  outcome.result.outcome = {
    status: "conflict",
    operationId: outcome.operation.operationId,
    series,
    current: null,
  }
  outcome.local = null
  backup.stores.occurrences = []
  backup.stores.remoteShadows = []
  const result = validateLocalRecurringBackup(backup, backup.userId)
  expect(result).toEqual(backup)
  expect(result.stores.outbox[1].state).toBe("sending")
})
test("foreign or contradictory evidence, orphan parent, forged ACK and unordered dependencies fail the whole backup", () => {
  const { backup } = fixture()
  for (const change of [
    (value: typeof backup) => {
      value.stores.items[0].ownerId = "foreign"
    },
    (value: typeof backup) => {
      value.stores.items = []
    },
    (value: typeof backup) => {
      value.stores.outbox[0].operation.baseRevision = 2
    },
    (value: typeof backup) => {
      value.stores.outbox[0].state = "rejected"
    },
    (value: typeof backup) => {
      value.stores.outbox[0].state = "superseded"
    },
    (value: typeof backup) => {
      value.stores.outbox[1].dependencies = [crypto.randomUUID()]
    },
    (value: typeof backup) => {
      value.stores.syncMetadata = value.stores.syncMetadata.filter(
        (record) => !("result" in record)
      )
    },
    (value: typeof backup) => {
      value.stores.syncMetadata = value.stores.syncMetadata.filter(
        (record) => record.key !== "outbox-sequence"
      )
    },
    (value: typeof backup) => {
      value.stores.remoteShadows.push(value.stores.remoteShadows[0])
    },
    (value: typeof backup) => {
      const shadow = value.stores.remoteShadows[0]
      if (!("kind" in shadow) || shadow.kind !== "plan-occurrence")
        throw new Error("Appearance fixture is missing")
      shadow.record.cancelled = true
    },
    (value: typeof backup) => {
      value.stores.occurrences.push(value.stores.occurrences[0])
    },
  ]) {
    const value = structuredClone(backup)
    change(value)
    expect(() => validateLocalRecurringBackup(value, value.userId)).toThrow()
  }
  expect(() => validateLocalRecurringBackup(backup, "foreign")).toThrow()
})
test("future codec keeps legacy format and strict size and parse boundaries", () => {
  const { backup } = fixture()
  const stores = {
    ...backup.stores,
    outbox: [],
    occurrences: [],
    remoteShadows: [],
    syncMetadata: [],
  }
  for (const version of [1, 2] as const) {
    const legacy = { ...backup, version, stores }
    expect(validateLocalRecurringBackup(legacy, backup.userId)).toEqual(
      validateLocalBackup(legacy, backup.userId)
    )
    expect(
      decodeLocalRecurringBackup(
        encodeLocalRecurringBackup(legacy, backup.userId),
        backup.userId
      ).version
    ).toBe(version)
  }
  expect(() => decodeLocalRecurringBackup("invalid", backup.userId)).toThrow()
  expect(() =>
    decodeLocalRecurringBackup(
      " ".repeat(maximumBackupBytes + 1),
      backup.userId
    )
  ).toThrow("size limit")
})

test("recurring import keeps frozen evidence and copies only simple common plans with fresh identities", () => {
  const { backup, series } = fixture()
  const simple = {
    ...series,
    id: crypto.randomUUID(),
    variant: "note" as const,
    recurrence: null,
    revision: 0,
  }
  const source = {
    ...backup,
    stores: { ...backup.stores, items: [series, simple] },
  }
  const json = encodeLocalRecurringBackup(source, backup.userId)
  const preserved = structuredClone(backup)
  const preview = previewLocalBackupImport(
    json,
    backup,
    backup.userId,
    "common_plans",
    true
  )
  expect(
    preview.stores.items.find((row) => row.key === simple.id)?.support
  ).toBe("simple_item")
  expect(
    preview.stores.items.find((row) => row.key === series.id)?.support
  ).toBe("unsupported")
  expect(
    preview.stores.outbox.every((row) => row.support === "evidence_only")
  ).toBe(true)
  expect(() => previewLocalBackupImport(json, backup, backup.userId)).toThrow()
  const request = {
    userId: backup.userId,
    importId: crypto.randomUUID(),
    createdAt: timestamp,
    expected: backup,
    copies: [
      {
        sourceItemId: simple.id,
        itemId: crypto.randomUUID(),
        operationId: crypto.randomUUID(),
      },
    ],
  }
  const plan = planLocalBackupImport(request, json, backup, true)
  expect(plan.copies).toHaveLength(1)
  expect(plan.copies[0]?.item).toMatchObject({
    kind: "plan",
    variant: "note",
    recurrence: null,
    revision: 0,
    ownerId: backup.userId,
  })
  expect(plan.copies[0]?.item.id).not.toBe(simple.id)
  expect(plan.copies[0]?.operation).toMatchObject({
    protocolVersion: 1,
    baseRevision: 0,
    command: { type: "item.create" },
  })
  const receipt = buildBackupImportRecord(plan)
  const copied = plan.copies[0]
  if (!copied) throw new Error("Import fixture copy is missing")
  const post = {
    ...backup,
    stores: {
      ...backup.stores,
      items: [...backup.stores.items, copied.item],
      outbox: [
        ...backup.stores.outbox,
        outboxEntrySchema.parse({
          userId: backup.userId,
          entityKey: `item:${copied.item.id}`,
          operation: copied.operation,
          sequence: 3,
          state: "pending",
          attempts: 0,
          lease: null,
          dependencies: [],
          createdAt: timestamp,
        }),
      ],
      syncMetadata: [
        ...backup.stores.syncMetadata.filter(
          (value) => value.key !== "outbox-sequence"
        ),
        { key: "outbox-sequence" as const, value: 3 },
        receipt,
      ],
    },
  }
  expect(
    decodeLocalRecurringBackup(
      encodeLocalRecurringBackup(post, backup.userId),
      backup.userId
    ).stores
  ).toEqual(post.stores)
  expect(backup).toEqual(preserved)
  expect(() =>
    planLocalBackupImport(
      {
        ...request,
        copies: [{ ...request.copies[0], sourceItemId: series.id }],
      },
      json,
      backup,
      true
    )
  ).toThrow()
  expect(() =>
    planLocalBackupImport(
      request,
      json,
      {
        ...backup,
        stores: {
          ...backup.stores,
          tags: [],
          syncMetadata: backup.stores.syncMetadata.filter(
            (value) => value.key !== "pull-cursor"
          ),
        },
      },
      true
    )
  ).toThrow()
  expect(() => planLocalBackupImport(request, json, backup)).toThrow()
})
