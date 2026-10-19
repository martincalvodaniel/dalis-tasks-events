import { expect, test } from "bun:test"
import {
  decodeLocalRecurringBackup,
  encodeLocalRecurringBackup,
  validateLocalRecurringBackup,
} from "@/lib/backup/local-backup"
import { placementResolutionFixture } from "@/lib/backup/placement-resolution-fixture"
import { planPlacementIncidentResolution } from "@/lib/sync/placement-decision"
import { outboxEntrySchema } from "@/schemas/local-sync"

function fixture(retry = true) {
  const f = placementResolutionFixture(),
    request = {
      userId: f.actor,
      resolutionId: crypto.randomUUID(),
      operationId: retry ? crypto.randomUUID() : null,
      choice: retry ? "retry_latest_move" : "adopt_remote",
      createdAt: f.now,
      expected: f.snapshot,
    },
    record = planPlacementIncidentResolution(request, f.snapshot)
  const backup = {
    format: "dalis-local-backup" as const,
    version: 3 as const,
    protocolVersion: 1 as const,
    databaseVersion: 2 as const,
    userId: f.actor,
    exportedAt: f.now,
    stores: {
      items: structuredClone(f.items),
      occurrences: [],
      tags: [],
      itemViews: structuredClone(f.local.views),
      taskPlacements: structuredClone(record.placements),
      settings: [],
      memberships: [],
      invitations: [],
      remoteShadows: structuredClone(f.input.shadows),
      outbox: [
        ...f.capture.entries.map((entry) => ({
          ...structuredClone(entry),
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
        structuredClone(f.outcome),
        record,
        { key: "outbox-sequence" as const, value: retry ? 3 : 2 },
      ],
    },
  }
  return { ...f, request, record, backup: structuredClone(backup) }
}
for (const retry of [true, false])
  test(`placement ${retry ? "retry" : "adopt"} portable evidence roundtrips with complete catalog and history`, () => {
    const f = fixture(retry)
    expect(
      decodeLocalRecurringBackup(
        encodeLocalRecurringBackup(f.backup, f.actor),
        f.actor
      )
    ).toEqual(f.backup)
    expect(
      f.backup.stores.outbox.filter((entry) => entry.state === "acknowledged")
    ).toHaveLength(0)
    expect(f.backup.stores.taskPlacements).toEqual(f.record.placements)
  })
test("placement backup preserves pending attempted retries and later catalog edits", () => {
  const f = fixture()
  f.backup.stores.outbox[2].attempts = 1
  f.backup.stores.taskPlacements[0].position = 9000
  f.backup.stores.items[0].title = "Later edit"
  expect(validateLocalRecurringBackup(f.backup, f.actor)).toEqual(f.backup)
})
test("placement backup cannot lose original intention, outcome, retry or durable decision", () => {
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
test("placement backup rejects altered source attempts, order, commands and retry correspondence", () => {
  for (const index of [0, 1, 2])
    for (const field of [
      "attempts",
      "sequence",
      "dependencies",
      "operation",
      "createdAt",
    ]) {
      if (index === 2 && field === "attempts") continue
      const f = fixture(),
        entry = f.backup.stores.outbox[index]
      if (field === "attempts") entry.attempts++
      if (field === "sequence") entry.sequence = 50
      if (field === "dependencies")
        entry.dependencies =
          index === 2 ? [f.entry.operation.operationId] : [crypto.randomUUID()]
      if (field === "operation") entry.operation.baseRevision = 20
      if (field === "createdAt") entry.createdAt = "2026-10-18T20:40:00.000Z"
      expect(() => validateLocalRecurringBackup(f.backup, f.actor)).toThrow()
    }
})
test("placement durable catalog, latest move and optimistic revision evidence are exact", () => {
  for (const change of ["catalog", "revision", "superseded", "foreign"]) {
    const f = fixture(),
      record = f.backup.stores.syncMetadata[1]
    if (!("placements" in record))
      throw new Error("Fixture placement receipt missing")
    if (change === "catalog") record.expected.observed.placements.pop()
    if (change === "revision") record.placements[0].revision++
    if (change === "superseded") record.supersededOperationIds.pop()
    if (change === "foreign")
      record.expected.observed.placements[0].userId = "foreign"
    expect(() => validateLocalRecurringBackup(f.backup, f.actor)).toThrow()
  }
})
test("placement acknowledged prerequisites need exact applied outcomes rather than captured DTOs", () => {
  const f = fixture(),
    ancestor = outboxEntrySchema.parse({
      ...f.entry,
      state: "acknowledged",
      sequence: 1,
      dependencies: [],
      operation: {
        ...f.entry.operation,
        operationId: crypto.randomUUID(),
        baseRevision: 1,
      },
    }),
    chain = f.capture.entries.map((entry) => ({
      ...entry,
      sequence: entry.sequence + 1,
      dependencies:
        entry.sequence === 1
          ? [ancestor.operation.operationId]
          : entry.dependencies,
    })),
    expected = {
      ...f.snapshot,
      incident: { ...f.snapshot.incident, entry: chain[0], intentions: chain },
      acknowledgedDependencies: [ancestor],
    },
    record = planPlacementIncidentResolution(
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
          effects: [
            { store: "taskPlacements" as const, record: f.original[0] },
          ],
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
test("placement decisions participate in global resolution ID and operation collision guards", () => {
  const f = fixture(),
    copy = {
      ...f.record,
      resolutionId: f.entry.operation.operationId,
      key: `placement-resolution:${f.entry.operation.operationId}`,
    }
  f.backup.stores.syncMetadata[1] = copy
  expect(() => validateLocalRecurringBackup(f.backup, f.actor)).toThrow()
  const other = fixture(false),
    second = planPlacementIncidentResolution(
      {
        ...other.request,
        userId: f.actor,
        resolutionId: f.record.resolutionId,
        expected: f.snapshot,
      },
      f.snapshot
    )
  f.backup.stores.syncMetadata.push(second)
  expect(() => validateLocalRecurringBackup(f.backup, f.actor)).toThrow()
})
