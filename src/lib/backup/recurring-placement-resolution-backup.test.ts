import { expect, test } from "bun:test"
import {
  decodeLocalRecurringBackup,
  encodeLocalRecurringBackup,
  validateLocalRecurringBackup,
} from "@/lib/backup/local-backup"
import { recurringPlacementResolutionBackupFixture } from "@/lib/backup/recurring-placement-resolution-fixture"
import { planRemoteRecurringTaskPlacementOperation } from "@/lib/preferences/remote-recurring-task-placement-plan"
import { planLocalSettingsPreferenceResult } from "@/lib/sync/preference-result-plan"
import { planRecurringPlacementIncidentResolution } from "@/lib/sync/recurring-placement-decision"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import { personalSnapshotSchema } from "@/schemas/personal-snapshot"
import { remotePreferenceEffectsSchema } from "@/schemas/preference-effects"

for (const slot of ["moved", "implicit"] as const)
  for (const scope of ["day", "overdue"] as const)
    for (const retry of [true, false])
      test(`recurring ${slot} ${scope} ${retry ? "retry" : "adopt"} backup keeps complete context and exact history`, () => {
        const f = recurringPlacementResolutionBackupFixture(retry, slot, scope)
        expect(
          decodeLocalRecurringBackup(
            encodeLocalRecurringBackup(f.backup, f.simple.actor),
            f.simple.actor
          )
        ).toEqual(f.backup)
        expect(
          f.backup.stores.outbox.filter(
            (entry) => entry.state === "acknowledged"
          )
        ).toHaveLength(0)
        expect(f.backup.stores.occurrences).toEqual(
          f.snapshot.observed.occurrences
        )
        expect(f.backup.stores.taskPlacements).toEqual(f.record.placements)
        expect(() =>
          validateLocalRecurringBackup(
            { ...f.backup, version: 2 },
            f.simple.actor
          )
        ).toThrow()
      })
test("recurring backup preserves attempted pending replacement and later edits, never ACK without evidence", () => {
  const f = recurringPlacementResolutionBackupFixture()
  f.backup.stores.outbox[2].attempts = 1
  f.backup.stores.items[0].title = "Later draft"
  f.backup.stores.taskPlacements[0].position = 9000
  expect(validateLocalRecurringBackup(f.backup, f.simple.actor)).toEqual(
    f.backup
  )
  f.backup.stores.outbox[2].state = "acknowledged"
  expect(() => validateLocalRecurringBackup(f.backup, f.simple.actor)).toThrow()
})
test("recurring portable evidence rejects missing original, outcome, decision, replacement and a stripped family marker", () => {
  for (const index of [0, 1, 2]) {
    const f = recurringPlacementResolutionBackupFixture()
    f.backup.stores.outbox.splice(index, 1)
    expect(() =>
      validateLocalRecurringBackup(f.backup, f.simple.actor)
    ).toThrow()
  }
  for (const index of [0, 1]) {
    const f = recurringPlacementResolutionBackupFixture()
    f.backup.stores.syncMetadata.splice(index, 1)
    expect(() =>
      validateLocalRecurringBackup(f.backup, f.simple.actor)
    ).toThrow()
  }
  const f = recurringPlacementResolutionBackupFixture()
  f.backup.stores.syncMetadata = f.backup.stores.syncMetadata.map((value) => {
    if (!("reviewKind" in value)) return value
    const { reviewKind: _, ...legacy } = value
    return legacy
  })
  expect(() => validateLocalRecurringBackup(f.backup, f.simple.actor)).toThrow()
})
test("recurring history and replacement correspondence cannot be rewritten", () => {
  for (const index of [0, 1, 2])
    for (const field of [
      "operation",
      "dependencies",
      "sequence",
      "createdAt",
      "attempts",
    ]) {
      if (index === 2 && field === "attempts") continue
      const f = recurringPlacementResolutionBackupFixture(),
        entry = f.backup.stores.outbox[index]
      if (field === "operation") entry.operation.baseRevision++
      if (field === "dependencies") entry.dependencies = [crypto.randomUUID()]
      if (field === "sequence") entry.sequence = 40
      if (field === "createdAt") entry.createdAt = "2026-10-20T00:00:00.000Z"
      if (field === "attempts") entry.attempts++
      expect(() =>
        validateLocalRecurringBackup(f.backup, f.simple.actor)
      ).toThrow()
    }
})
test("an applied multieffect result keeps portable evidence and exact committed peer positions", () => {
  const f = recurringPlacementResolutionBackupFixture(),
    operation = f.record.replacement
  if (!operation) throw new Error("Recurring retry missing")
  const remote = planRemoteRecurringTaskPlacementOperation(
    {
      userId: f.simple.actor,
      timestamp: f.simple.now,
      operation,
      ...f.snapshot.observed,
    },
    false
  )
  if (remote.status !== "changes")
    throw new Error("Recurring remote effects missing")
  const effects = remotePreferenceEffectsSchema.parse({
    version: 1,
    userId: f.simple.actor,
    operationId: operation.operationId,
    sequence: 17,
    effects: remote.effects,
  })
  const senderId = crypto.randomUUID()
  const planned = planLocalSettingsPreferenceResult({
    userId: f.simple.actor,
    submission: {
      operation,
      senderId,
      result: {
        kind: "preference",
        outcome: {
          status: "applied",
          operationId: operation.operationId,
          effects,
        },
      },
    },
    existingOutcome: null,
    local: personalSnapshotSchema.parse([
      ...f.backup.stores.itemViews.map((record) => ({
        entityKey: `item-view:${record.itemId}`,
        record: { store: "itemViews", record },
      })),
      ...f.backup.stores.taskPlacements.map((record) => ({
        entityKey: taskPlacementEntityKey(
          record.occurrenceId,
          record.scope,
          record.date
        ),
        record: { store: "taskPlacements", record },
      })),
    ]),
    shadows: f.backup.stores.remoteShadows.filter(
      (shadow) => !("kind" in shadow && shadow.kind === "plan-occurrence")
    ),
    entries: f.backup.stores.outbox.map((entry) =>
      entry.operation.operationId === operation.operationId
        ? outboxEntrySchema.parse({
            ...entry,
            state: "sending",
            attempts: 1,
            lease: { ownerId: senderId, expiresAt: "2026-10-20T01:00:00.000Z" },
          })
        : entry
    ),
  })
  f.backup.stores.outbox = planned.entries
  f.backup.stores.taskPlacements = planned.local.flatMap((snapshot) =>
    snapshot.record?.store === "taskPlacements" ? [snapshot.record.record] : []
  )
  f.backup.stores.remoteShadows = [
    ...f.backup.stores.remoteShadows.filter(
      (shadow) => !("kind" in shadow && shadow.kind === "preference")
    ),
    ...planned.shadows,
  ]
  f.backup.stores.syncMetadata.push(planned.outcome)
  expect(validateLocalRecurringBackup(f.backup, f.simple.actor)).toEqual(
    f.backup
  )
  expect(f.backup.stores.outbox[2].state).toBe("acknowledged")
  expect(
    f.backup.stores.outbox
      .slice(0, 2)
      .every((entry) => entry.state === "superseded")
  ).toBe(true)
  for (const effect of remote.effects) {
    if (effect.store !== "taskPlacements")
      throw new Error("Unexpected view write")
    expect(
      f.backup.stores.taskPlacements.find(
        (record) => record.occurrenceId === effect.record.occurrenceId
      )
    ).toEqual(effect.record)
  }
})

test("recurring prerequisites require matching applied outcomes and exact preserved ACK history", () => {
  const f = recurringPlacementResolutionBackupFixture()
  const ancestor = outboxEntrySchema.parse({
    ...f.entry,
    state: "acknowledged",
    operation: {
      ...f.entry.operation,
      operationId: crypto.randomUUID(),
      baseRevision: 0,
    },
    sequence: 1,
  })
  const chain = f.capture.entries.map((entry, index) => ({
    ...entry,
    sequence: entry.sequence + 1,
    dependencies: index ? entry.dependencies : [ancestor.operation.operationId],
  }))
  const expected = {
    ...f.snapshot,
    incident: { ...f.snapshot.incident, entry: chain[0], intentions: chain },
    acknowledgedDependencies: [ancestor],
  }
  const record = planRecurringPlacementIncidentResolution(
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
  expect(() => validateLocalRecurringBackup(f.backup, f.simple.actor)).toThrow()
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
          userId: f.simple.actor,
          operationId: ancestor.operation.operationId,
          sequence: 1,
          effects: [
            {
              store: "taskPlacements" as const,
              record: { ...f.known, revision: 1 },
            },
          ],
        },
      },
    },
  }
  f.backup.stores.syncMetadata.push(applied)
  expect(validateLocalRecurringBackup(f.backup, f.simple.actor)).toEqual(
    f.backup
  )
  f.backup.stores.outbox[0].attempts++
  expect(() => validateLocalRecurringBackup(f.backup, f.simple.actor)).toThrow(
    "durable ACK"
  )
})
test("recurring recovery participates in exclusive supersession and global decision identity guards", () => {
  const f = recurringPlacementResolutionBackupFixture(false)
  const second = planRecurringPlacementIncidentResolution(
    { ...f.request, resolutionId: crypto.randomUUID() },
    f.snapshot
  )
  f.backup.stores.syncMetadata.push(second)
  expect(() => validateLocalRecurringBackup(f.backup, f.simple.actor)).toThrow(
    "multiple recovery"
  )
  const reused = recurringPlacementResolutionBackupFixture(false)
  reused.backup.stores.syncMetadata[1] = {
    ...reused.record,
    resolutionId: reused.simple.entry.operation.operationId,
    key: `placement-resolution:${reused.simple.entry.operation.operationId}`,
  }
  expect(() =>
    validateLocalRecurringBackup(reused.backup, reused.simple.actor)
  ).toThrow("identity")
})
