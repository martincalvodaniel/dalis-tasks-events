import { expect, test } from "bun:test"
import {
  decodeLocalRecurringBackup,
  encodeLocalRecurringBackup,
  validateLocalRecurringBackup,
} from "@/lib/backup/local-backup"
import { planOccurrenceCohortResolutionFixture } from "@/lib/backup/plan-occurrence-cohort-resolution-fixture"
import { planOccurrenceCopyBackupFixture } from "@/lib/backup/plan-occurrence-copy-fixture"
import { planOccurrenceCopy } from "@/lib/sync/plan-occurrence-copy"
import { localItemOutcomeV2Schema } from "@/schemas/local-item-outcome-v2"
import { localPlanOccurrenceOutcomeSchema } from "@/schemas/local-plan-occurrence-sync"
import { outboxEntrySchema } from "@/schemas/local-sync"

for (const variant of ["task", "event", "appointment", "note"] as const)
  test(`${variant} appearance copy roundtrips without copying other slots or declaring ACK`, () => {
    const f = planOccurrenceCopyBackupFixture(variant),
      before = JSON.stringify(f.backup)
    expect(
      decodeLocalRecurringBackup(
        encodeLocalRecurringBackup(f.backup, f.userId),
        f.userId
      )
    ).toEqual(f.backup)
    expect(f.backup.stores.items).toHaveLength(2)
    expect(f.backup.stores.occurrences[1]).toEqual(f.occurrences[1])
    expect(
      f.backup.stores.outbox.filter((entry) => entry.state === "acknowledged")
    ).toHaveLength(0)
    expect(f.backup.stores.tags).toEqual([])
    expect(f.backup.stores.itemViews).toEqual([])
    expect(f.backup.stores.taskPlacements).toEqual([])
    expect(JSON.stringify(f.backup)).toBe(before)
    expect(() =>
      validateLocalRecurringBackup({ ...f.backup, version: 2 }, f.userId)
    ).toThrow()
  })

test("appearance copy requires every original, outcome, replacement and retained record", () => {
  for (const target of [
    "root",
    "child",
    "replacement",
    "outcome",
    "decision",
    "copy",
    "parent",
    "slot",
  ] as const) {
    const f = planOccurrenceCopyBackupFixture(),
      stores = f.backup.stores
    if (target === "root") stores.outbox.splice(0, 1)
    if (target === "child") stores.outbox.splice(1, 1)
    if (target === "replacement") stores.outbox.splice(2, 1)
    if (target === "outcome")
      stores.syncMetadata = stores.syncMetadata.filter(
        (record) => !("result" in record)
      )
    if (target === "decision")
      stores.syncMetadata = stores.syncMetadata.filter(
        (record) =>
          !("reviewKind" in record && record.reviewKind === "occurrence_copy")
      )
    if (target === "copy")
      stores.items = stores.items.filter(
        (item) => item.id !== f.record.copyItemId
      )
    if (target === "parent")
      stores.items = stores.items.filter((item) => item.id !== f.series.id)
    if (target === "slot")
      stores.occurrences = stores.occurrences.filter(
        (record) => record.id !== f.record.local.id
      )
    expect(() => validateLocalRecurringBackup(f.backup, f.userId)).toThrow()
  }
})

test("appearance copy preserves exact original payload, attempts, sequence, date and dependencies", () => {
  for (const field of [
    "operation",
    "attempts",
    "sequence",
    "date",
    "dependencies",
  ] as const) {
    const f = planOccurrenceCopyBackupFixture(),
      entry = f.backup.stores.outbox[1]
    if (field === "operation") entry.operation.baseRevision++
    if (field === "attempts") entry.attempts++
    if (field === "sequence") entry.sequence = 2
    if (field === "date") entry.createdAt = f.record.createdAt
    if (field === "dependencies") entry.dependencies = []
    expect(() => validateLocalRecurringBackup(f.backup, f.userId)).toThrow()
  }
})

test("appearance copy requires exact replacement identity, entity, order, timestamp and dependencies", () => {
  for (const field of [
    "operation",
    "sequence",
    "date",
    "dependencies",
    "entity",
    "owner",
  ] as const) {
    const f = planOccurrenceCopyBackupFixture(),
      entry = f.backup.stores.outbox[2]
    if (field === "operation") entry.operation.baseRevision++
    if (field === "sequence") entry.sequence = 2
    if (field === "date") entry.createdAt = f.series.createdAt
    if (field === "dependencies")
      entry.dependencies = [f.entries[1].operation.operationId]
    if (field === "entity") entry.entityKey = `item:${f.series.id}`
    if (field === "owner") entry.userId = "foreign"
    expect(() => validateLocalRecurringBackup(f.backup, f.userId)).toThrow()
  }
})

test("pending attempted copy and later edits remain portable without overwriting current projections", () => {
  const f = planOccurrenceCopyBackupFixture(),
    copy = f.backup.stores.items[1]
  copy.title = "A later edit to my new plan"
  f.backup.stores.items[0].title = "A later edit to the parent"
  f.backup.stores.outbox[2].attempts = 1
  expect(validateLocalRecurringBackup(f.backup, f.userId)).toEqual(f.backup)
  f.backup.stores.outbox[2].state = "acknowledged"
  expect(() => validateLocalRecurringBackup(f.backup, f.userId)).toThrow(
    "durable operation evidence"
  )
})

test("an applied copy requires matching operation evidence rather than an ACK DTO", () => {
  const f = planOccurrenceCopyBackupFixture(),
    entry = f.backup.stores.outbox[2],
    item = { ...f.record.copy, revision: 1 },
    outcome = localItemOutcomeV2Schema.parse({
      version: 2,
      kind: "item",
      key: `operation-outcome:${entry.operation.operationId}`,
      operation: entry.operation,
      result: {
        kind: "item",
        outcome: {
          status: "applied",
          operationId: entry.operation.operationId,
          item,
          sequence: 1,
        },
      },
      local: f.record.copy,
      base: null,
    })
  entry.state = "acknowledged"
  entry.attempts = 2
  f.backup.stores.items[1] = item
  f.backup.stores.remoteShadows.push({
    version: 2,
    kind: "item",
    entityKey: `item:${item.id}`,
    record: item,
  })
  f.backup.stores.syncMetadata.push(outcome)
  expect(validateLocalRecurringBackup(f.backup, f.userId)).toEqual(f.backup)
  const corrupt = structuredClone(f.backup)
  const stored = corrupt.stores.syncMetadata.find(
    (record) =>
      "result" in record &&
      record.operation.operationId === entry.operation.operationId
  )
  if (!stored || !("result" in stored))
    throw new Error("Modeled copy outcome missing")
  stored.operation = { ...stored.operation, baseRevision: 1 }
  expect(() => validateLocalRecurringBackup(corrupt, f.userId)).toThrow()
})

test("a self-consistent captured outcome cannot replace the durable original", () => {
  const f = planOccurrenceCopyBackupFixture(),
    expected = structuredClone(f.snapshot)
  if (!expected.localAtOutcome)
    throw new Error("Copy fixture frozen local is missing")
  expected.localAtOutcome.content = {
    title: "Different old draft",
    description: "",
  }
  expected.outcome.local = expected.localAtOutcome
  const forged = planOccurrenceCopy({ ...f.request, expected }, expected)
  f.backup.stores.syncMetadata = f.backup.stores.syncMetadata.map((record) =>
    "reviewKind" in record && record.reviewKind === "occurrence_copy"
      ? forged
      : record
  )
  expect(() => validateLocalRecurringBackup(f.backup, f.userId)).toThrow(
    "frozen outcome evidence"
  )
})

test("appearance copy rejects external dependencies, duplicate decisions and reused copy identities", () => {
  const f = planOccurrenceCopyBackupFixture(),
    entry = f.backup.stores.outbox[2]
  f.backup.stores.outbox.push(
    outboxEntrySchema.parse({
      ...entry,
      sequence: 5,
      entityKey: `item:${f.series.id}`,
      operation: {
        ...entry.operation,
        operationId: crypto.randomUUID(),
        command: { type: "item.delete", itemId: f.series.id },
      },
      dependencies: [f.entries[0].operation.operationId],
    })
  )
  f.backup.stores.syncMetadata = f.backup.stores.syncMetadata.map((record) =>
    record.key === "outbox-sequence"
      ? { key: "outbox-sequence", value: 5 }
      : record
  )
  expect(() => validateLocalRecurringBackup(f.backup, f.userId)).toThrow(
    "external dependent"
  )
  const duplicate = planOccurrenceCopyBackupFixture()
  duplicate.backup.stores.syncMetadata.push(
    planOccurrenceCopy(
      { ...duplicate.request, resolutionId: crypto.randomUUID() },
      duplicate.snapshot
    )
  )
  expect(() =>
    validateLocalRecurringBackup(duplicate.backup, duplicate.userId)
  ).toThrow("copy item IDs")
  const collision = planOccurrenceCopyBackupFixture(),
    replacement = collision.backup.stores.outbox[2]
  collision.backup.stores.outbox.push(
    outboxEntrySchema.parse({
      ...replacement,
      sequence: 5,
      entityKey: `item:${collision.series.id}`,
      operation: {
        ...replacement.operation,
        operationId: collision.record.copyItemId,
        command: { type: "item.delete", itemId: collision.series.id },
      },
    })
  )
  collision.backup.stores.syncMetadata =
    collision.backup.stores.syncMetadata.map((record) =>
      record.key === "outbox-sequence"
        ? { key: "outbox-sequence", value: 5 }
        : record
    )
  expect(() =>
    validateLocalRecurringBackup(collision.backup, collision.userId)
  ).toThrow("copy identity collides")
})

test("the copy item identity cannot have been used in earlier history", () => {
  const f = planOccurrenceCopyBackupFixture(),
    entry = f.backup.stores.outbox[2]
  f.backup.stores.outbox.push(
    outboxEntrySchema.parse({
      ...entry,
      sequence: 2,
      operation: {
        ...entry.operation,
        operationId: crypto.randomUUID(),
        command: {
          type: "plan.set-status",
          itemId: f.record.copyItemId,
          status: "not_started",
        },
      },
    })
  )
  expect(() => validateLocalRecurringBackup(f.backup, f.userId)).toThrow(
    "already used"
  )
})

test("stripped or corrupted copy decisions cannot fall through to another recovery family", () => {
  for (const change of ["family", "key", "copy", "slot", "ids"] as const) {
    const f = planOccurrenceCopyBackupFixture()
    const metadata = f.backup.stores.syncMetadata.map((record) => {
      if (!("reviewKind" in record) || record.reviewKind !== "occurrence_copy")
        return record
      if (change === "family") {
        const { reviewKind: _, ...rest } = record
        return rest
      }
      if (change === "key")
        return {
          ...record,
          key: `appearance-resolution:${record.resolutionId}`,
        }
      if (change === "copy")
        return { ...record, copy: { ...record.copy, title: "Unreviewed" } }
      if (change === "slot")
        return { ...record, local: { ...record.local, cancelled: false } }
      return {
        ...record,
        supersededOperationIds: record.supersededOperationIds.slice(1),
      }
    })
    expect(() =>
      validateLocalRecurringBackup(
        { ...f.backup, stores: { ...f.backup.stores, syncMetadata: metadata } },
        f.userId
      )
    ).toThrow()
  }
})

test("a previously unattempted original cannot gain an unreviewed outcome in the backup", () => {
  const f = planOccurrenceCopyBackupFixture(),
    child = f.backup.stores.outbox[1],
    result = f.outcomes[0].result.outcome
  if (result.status !== "conflict")
    throw new Error("Expected original conflict")
  f.backup.stores.syncMetadata.push(
    localPlanOccurrenceOutcomeSchema.parse({
      ...f.outcomes[0],
      key: `operation-outcome:${child.operation.operationId}`,
      operation: child.operation,
      result: {
        ...f.outcomes[0].result,
        outcome: { ...result, operationId: child.operation.operationId },
      },
    })
  )
  expect(() => validateLocalRecurringBackup(f.backup, f.userId)).toThrow(
    "unexpected outcome"
  )
})

test("appearance copy cannot claim originals already assigned to another copy decision", () => {
  const f = planOccurrenceCopyBackupFixture(),
    second = planOccurrenceCopy(
      {
        ...f.request,
        resolutionId: crypto.randomUUID(),
        operationId: crypto.randomUUID(),
        copyItemId: crypto.randomUUID(),
      },
      f.snapshot
    )
  f.backup.stores.items.push(second.copy)
  f.backup.stores.outbox.push(
    outboxEntrySchema.parse({
      ...f.backup.stores.outbox[2],
      entityKey: `item:${second.copyItemId}`,
      operation: second.replacement,
      sequence: 5,
    })
  )
  f.backup.stores.syncMetadata = f.backup.stores.syncMetadata.map((record) =>
    record.key === "outbox-sequence"
      ? { key: "outbox-sequence", value: 5 }
      : record
  )
  f.backup.stores.syncMetadata.push(second)
  expect(() => validateLocalRecurringBackup(f.backup, f.userId)).toThrow(
    "multiple recovery decisions"
  )
})

test("appearance copy decision IDs are exclusive across recovery families", () => {
  const f = planOccurrenceCopyBackupFixture(),
    other = planOccurrenceCohortResolutionFixture(false, false, f.userId)
  f.backup.stores.syncMetadata.push({
    ...other.record,
    resolutionId: f.record.resolutionId,
    key: `appearance-cohort-resolution:${f.record.resolutionId}`,
  })
  expect(() => validateLocalRecurringBackup(f.backup, f.userId)).toThrow(
    "resolution IDs"
  )
})
