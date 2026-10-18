import { expect, test } from "bun:test"
import {
  decodeLocalRecurringBackup,
  encodeLocalRecurringBackup,
  validateLocalRecurringBackup,
} from "@/lib/backup/local-backup"
import { tagDeletionResolutionFixture } from "@/lib/backup/tag-delete-resolution-fixture"
import { planTagDeletionIncidentResolution } from "@/lib/sync/tag-delete-decision"
import { outboxEntrySchema } from "@/schemas/local-sync"

function fixture(retry = true) {
  const f = tagDeletionResolutionFixture(),
    request = {
      userId: f.actor,
      resolutionId: crypto.randomUUID(),
      operationId: retry ? crypto.randomUUID() : null,
      choice: retry ? "retry_delete" : "adopt_remote",
      createdAt: f.now,
      expected: f.snapshot,
    },
    record = planTagDeletionIncidentResolution(request, f.snapshot)
  const backup = {
    format: "dalis-local-backup" as const,
    version: 3 as const,
    protocolVersion: 1 as const,
    databaseVersion: 2 as const,
    userId: f.actor,
    exportedAt: f.now,
    stores: {
      items: [],
      occurrences: [],
      tags: structuredClone(record.tags),
      itemViews: [],
      taskPlacements: [],
      settings: [],
      memberships: [],
      invitations: [],
      remoteShadows: structuredClone(f.input.shadows),
      outbox: [
        { ...f.entry, state: "superseded" as const },
        ...(record.replacement
          ? [
              outboxEntrySchema.parse({
                userId: f.actor,
                entityKey: f.entry.entityKey,
                operation: record.replacement,
                sequence: 2,
                dependencies: [],
                state: "pending",
                attempts: 0,
                lease: null,
                createdAt: record.createdAt,
              }),
            ]
          : []),
      ],
      syncMetadata: [
        f.outcome,
        record,
        { key: "outbox-sequence" as const, value: retry ? 2 : 1 },
      ],
    },
  }
  return { ...f, request, record, backup: structuredClone(backup) }
}
for (const retry of [true, false])
  test(`category deletion ${retry ? "retry" : "adopt"} backup roundtrips without losing tombstone or history`, () => {
    const f = fixture(retry)
    expect(
      decodeLocalRecurringBackup(
        encodeLocalRecurringBackup(f.backup, f.actor),
        f.actor
      )
    ).toEqual(f.backup)
    expect(
      f.backup.stores.outbox.some((entry) => entry.state === "acknowledged")
    ).toBe(false)
    expect(f.backup.stores.tags).toEqual(f.record.tags)
  })
test("deletion backup preserves later local catalog changes and uncertain replacement attempts", () => {
  const f = fixture()
  f.backup.stores.outbox[1].attempts = 1
  f.backup.stores.tags[1].position = 5000
  expect(validateLocalRecurringBackup(f.backup, f.actor)).toEqual(f.backup)
})
test("deletion evidence cannot lose source, outcome, replacement or receipt", () => {
  for (const index of [0, 1]) {
    const f = fixture()
    f.backup.stores.outbox.splice(index, 1)
    expect(() => validateLocalRecurringBackup(f.backup, f.actor)).toThrow()
  }
  for (const index of [0, 1]) {
    const f = fixture()
    f.backup.stores.syncMetadata.splice(index, 1)
    expect(() => validateLocalRecurringBackup(f.backup, f.actor)).toThrow()
  }
})
test("deletion originals and replacements retain exact commands, source attempts, sequences and dependencies", () => {
  for (const index of [0, 1])
    for (const field of [
      "attempts",
      "sequence",
      "command",
      "dependencies",
      "createdAt",
    ]) {
      if (index === 1 && field === "attempts") continue
      const f = fixture(),
        entry = f.backup.stores.outbox[index]
      if (field === "attempts") entry.attempts++
      if (field === "sequence") entry.sequence = 20
      if (field === "command")
        entry.operation.command = {
          type: "tag.delete",
          tagId: f.original[1].id,
        }
      if (field === "dependencies")
        entry.dependencies =
          index === 1 ? [f.entry.operation.operationId] : [crypto.randomUUID()]
      if (field === "createdAt") entry.createdAt = "2026-10-18T21:00:00.000Z"
      expect(() => validateLocalRecurringBackup(f.backup, f.actor)).toThrow()
    }
})
test("deletion prerequisite ACK requires its real applied outcome and exact preserved entry", () => {
  const f = fixture(),
    ancestor = outboxEntrySchema.parse({
      ...f.entry,
      state: "acknowledged",
      sequence: 1,
      dependencies: [],
      operation: { ...f.entry.operation, operationId: crypto.randomUUID() },
    }),
    entry = {
      ...f.entry,
      sequence: 2,
      dependencies: [ancestor.operation.operationId],
    },
    expected = {
      ...f.snapshot,
      incident: { ...f.snapshot.incident, entry, intentions: [entry] },
      acknowledgedDependencies: [ancestor],
    },
    record = planTagDeletionIncidentResolution(
      { ...f.request, expected },
      expected
    )
  f.backup.stores.outbox = [
    ancestor,
    { ...entry, state: "superseded" },
    { ...f.backup.stores.outbox[1], sequence: 3 },
  ]
  f.backup.stores.syncMetadata = [
    f.outcome,
    record,
    { key: "outbox-sequence", value: 3 },
  ]
  expect(() => validateLocalRecurringBackup(f.backup, f.actor)).toThrow()
  const applied = {
    ...f.outcome,
    key: `operation-outcome:${ancestor.operation.operationId}`,
    operation: ancestor.operation,
    result: {
      kind: "preference" as const,
      outcome: {
        status: "applied" as const,
        operationId: ancestor.operation.operationId,
        effects: {
          version: 1 as const,
          userId: f.actor,
          operationId: ancestor.operation.operationId,
          sequence: 1,
          effects: [{ store: "tags" as const, record: f.observed[0] }],
        },
      },
    },
  }
  f.backup.stores.syncMetadata.push(applied)
  expect(validateLocalRecurringBackup(f.backup, f.actor)).toEqual(f.backup)
  f.backup.stores.outbox[0].attempts++
  expect(() => validateLocalRecurringBackup(f.backup, f.actor)).toThrow(
    "durable ACK"
  )
})
test("deletion decision participates in global IDs and catalog evidence guards", () => {
  const f = fixture(),
    record = f.backup.stores.syncMetadata[1]
  if (!("resolutionId" in record))
    throw new Error("Fixture deletion decision missing")
  record.resolutionId = f.entry.operation.operationId
  record.key = `tag-delete-resolution:${record.resolutionId}`
  expect(() => validateLocalRecurringBackup(f.backup, f.actor)).toThrow()
  const other = fixture(),
    corrupt = other.backup.stores.syncMetadata[1]
  if (!("resolutionId" in corrupt))
    throw new Error("Fixture deletion decision missing")
  const primary = corrupt.tags.find((tag) => tag.id === other.original[0].id)
  if (!primary) throw new Error("Fixture deletion primary missing")
  primary.deletedAt = null
  expect(() =>
    validateLocalRecurringBackup(other.backup, other.actor)
  ).toThrow()
})
