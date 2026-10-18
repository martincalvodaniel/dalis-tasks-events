import { expect, test } from "bun:test"
import { itemViewResolutionFixture } from "@/lib/backup/item-view-resolution-fixture"
import {
  decodeLocalRecurringBackup,
  encodeLocalRecurringBackup,
  validateLocalRecurringBackup,
} from "@/lib/backup/local-backup"
import { planItemViewIncidentResolution } from "@/lib/sync/item-view-resolution"
import { outboxEntrySchema } from "@/schemas/local-sync"

function fixture(choice: "adopt_remote" | "retry_local" = "retry_local") {
  const f = itemViewResolutionFixture()
  const record = planItemViewIncidentResolution(
    {
      ...f.request,
      choice,
      operationId: choice === "retry_local" ? f.request.operationId : null,
    },
    f.current
  )
  const backup = {
    format: "dalis-local-backup" as const,
    version: 3 as const,
    protocolVersion: 1 as const,
    databaseVersion: 2 as const,
    userId: f.actor,
    exportedAt: f.now,
    stores: {
      items: [structuredClone(f.parent)],
      tags: [structuredClone(f.tag)],
      itemViews: [structuredClone(record.local)],
      occurrences: [],
      taskPlacements: [],
      settings: [],
      memberships: [],
      invitations: [],
      remoteShadows: [],
      outbox: [
        ...f.input.entries.map((entry) => ({
          ...entry,
          state: "superseded" as const,
        })),
        ...(record.replacement
          ? [
              outboxEntrySchema.parse({
                userId: f.actor,
                entityKey: f.entry.entityKey,
                operation: record.replacement,
                sequence: 3,
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
        { key: "outbox-sequence" as const, value: record.replacement ? 3 : 2 },
      ],
    },
  }
  return { ...f, record, backup: structuredClone(backup) }
}
for (const choice of ["adopt_remote", "retry_local"] as const)
  test(`assignment ${choice} portable evidence roundtrips without losing history`, () => {
    const f = fixture(choice)
    expect(
      decodeLocalRecurringBackup(
        encodeLocalRecurringBackup(f.backup, f.actor),
        f.actor
      )
    ).toEqual(f.backup)
    expect(f.backup.stores.items).toEqual([f.parent])
    expect(f.backup.stores.tags).toEqual([f.tag])
    expect(
      f.backup.stores.outbox.filter((e) => e.state === "acknowledged")
    ).toHaveLength(0)
  })
test("assignment backup accepts a pending attempted replacement and later local edits without fabricating ACK", () => {
  const f = fixture()
  f.backup.stores.outbox[2].attempts = 1
  f.backup.stores.itemViews[0].primaryTagId = null
  f.backup.stores.items[0].title = "Later edit"
  expect(validateLocalRecurringBackup(f.backup, f.actor)).toEqual(f.backup)
})
test("assignment backup rejects missing original, outcome, replacement or receipt", () => {
  for (const index of [0, 1, 2]) {
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
test("assignment backup rejects changed originals and replacement evidence", () => {
  for (const field of [
    "attempts",
    "sequence",
    "dependencies",
    "createdAt",
    "operation",
  ]) {
    const f = fixture(),
      entry = f.backup.stores.outbox[1]
    if (field === "attempts") entry.attempts++
    if (field === "sequence") entry.sequence = 10
    if (field === "dependencies") entry.dependencies = []
    if (field === "createdAt") entry.createdAt = "2026-10-18T16:00:00.000Z"
    if (field === "operation") entry.operation.baseRevision = 8
    expect(() => validateLocalRecurringBackup(f.backup, f.actor)).toThrow()
  }
  for (const field of ["dependencies", "createdAt", "sequence", "operation"]) {
    const f = fixture(),
      entry = f.backup.stores.outbox[2]
    if (field === "dependencies")
      entry.dependencies = [f.entry.operation.operationId]
    if (field === "createdAt") entry.createdAt = "2026-10-18T16:00:00.000Z"
    if (field === "sequence") entry.sequence = 1
    if (field === "operation") entry.operation.baseRevision = 8
    expect(() => validateLocalRecurringBackup(f.backup, f.actor)).toThrow()
  }
})

test("captured assignment ACK requires a real applied outcome, never just its DTO", () => {
  const f = fixture(),
    ancestor = outboxEntrySchema.parse({
      ...f.entry,
      state: "acknowledged",
      sequence: 1,
      dependencies: [],
      operation: {
        ...f.entry.operation,
        operationId: crypto.randomUUID(),
        baseRevision: 0,
      },
    })
  const chain = f.input.entries.map((entry) => ({
    ...entry,
    sequence: entry.sequence + 1,
    dependencies:
      entry.sequence === 1
        ? [ancestor.operation.operationId]
        : entry.dependencies,
  }))
  const expected = {
    ...f.current,
    incident: { ...f.current.incident, entry: chain[0], intentions: chain },
    acknowledgedDependencies: [ancestor],
  }
  const record = planItemViewIncidentResolution(
    { ...f.request, expected },
    expected
  )
  f.backup.stores.outbox = [
    ancestor,
    ...chain.map((entry) => ({ ...entry, state: "superseded" as const })),
    { ...f.backup.stores.outbox[2], sequence: 4 },
  ]
  f.backup.stores.syncMetadata = [
    f.outcome,
    record,
    { key: "outbox-sequence", value: 4 },
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
          effects: [{ store: "itemViews" as const, record: f.local }],
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
