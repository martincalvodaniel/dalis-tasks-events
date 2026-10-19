import { expect, test } from "bun:test"
import {
  decodeLocalRecurringBackup,
  encodeLocalRecurringBackup,
  validateLocalRecurringBackup,
} from "@/lib/backup/local-backup"
import { planOccurrenceCohortResolutionFixture } from "@/lib/backup/plan-occurrence-cohort-resolution-fixture"
import { planRemotePlanOccurrenceOperation } from "@/lib/calendar/remote-plan-occurrence-plan"
import { planOccurrenceCohortResolution } from "@/lib/sync/plan-occurrence-cohort-resolution"
import { planLocalPlanOccurrenceResult } from "@/lib/sync/plan-occurrence-result-plan"
import { outboxEntrySchema } from "@/schemas/local-sync"

for (const retry of [true, false])
  test(`joint appearance ${retry ? "retry" : "adopt"} roundtrips with all slots and exact history`, () => {
    const f = planOccurrenceCohortResolutionFixture(retry)
    expect(
      decodeLocalRecurringBackup(
        encodeLocalRecurringBackup(f.backup, f.source.userId),
        f.source.userId
      )
    ).toEqual(f.backup)
    expect(
      f.backup.stores.outbox.filter((entry) => entry.state === "acknowledged")
    ).toHaveLength(0)
    expect(f.backup.stores.occurrences).toEqual(
      f.record.locals.map((slot) => slot.record)
    )
    expect(() =>
      validateLocalRecurringBackup({ ...f.backup, version: 2 }, f.source.userId)
    ).toThrow()
  })
test("pending attempted replacements and later edits retain evidence without manufacturing an ACK", () => {
  const f = planOccurrenceCohortResolutionFixture()
  f.backup.stores.outbox[3].attempts = 1
  f.backup.stores.items[0].title = "Later local edit"
  const edited = f.backup.stores.occurrences[1]
  if (edited.kind !== "plan") throw new Error("Expected common appearance")
  edited.content = {
    title: "Later exception draft",
    description: "",
  }
  expect(validateLocalRecurringBackup(f.backup, f.source.userId)).toEqual(
    f.backup
  )
  f.backup.stores.outbox[3].state = "acknowledged"
  expect(() =>
    validateLocalRecurringBackup(f.backup, f.source.userId)
  ).toThrow()
})
test("truncated original operations, outcome, decision or a replacement cannot form a valid backup", () => {
  for (const index of [0, 1, 2, 3, 5, 6]) {
    const f = planOccurrenceCohortResolutionFixture()
    f.backup.stores.outbox.splice(index, 1)
    expect(() =>
      validateLocalRecurringBackup(f.backup, f.source.userId)
    ).toThrow()
  }
  for (const key of ["operation-outcome:", "appearance-cohort-resolution:"]) {
    const f = planOccurrenceCohortResolutionFixture()
    f.backup.stores.syncMetadata = f.backup.stores.syncMetadata.filter(
      (entry) => !entry.key.startsWith(key)
    )
    expect(() =>
      validateLocalRecurringBackup(f.backup, f.source.userId)
    ).toThrow()
  }
})
test("frozen original payload, attempts, sequence and cross-slot dependencies remain exact", () => {
  for (const change of [
    "payload",
    "attempts",
    "sequence",
    "dependencies",
    "timestamp",
  ] as const) {
    const f = planOccurrenceCohortResolutionFixture(),
      entry = f.backup.stores.outbox[1]
    if (change === "payload") entry.operation.baseRevision++
    if (change === "attempts") entry.attempts++
    if (change === "sequence") entry.sequence = 30
    if (change === "dependencies") entry.dependencies = []
    if (change === "timestamp") entry.createdAt = f.request.createdAt
    expect(() =>
      validateLocalRecurringBackup(f.backup, f.source.userId)
    ).toThrow()
  }
})
test("replacement payload, ordering, owner, date and dependency evidence must match the planned chain", () => {
  for (const change of [
    "payload",
    "sequence",
    "dependencies",
    "timestamp",
    "entity",
    "owner",
  ] as const) {
    const f = planOccurrenceCohortResolutionFixture(),
      entry = f.backup.stores.outbox[5]
    if (change === "payload") entry.operation.baseRevision++
    if (change === "sequence") entry.sequence = 40
    if (change === "dependencies") entry.dependencies = []
    if (change === "timestamp") entry.createdAt = f.source.series.createdAt
    if (change === "entity") entry.entityKey = `item:${crypto.randomUUID()}`
    if (change === "owner") entry.userId = "foreign"
    expect(() =>
      validateLocalRecurringBackup(f.backup, f.source.userId)
    ).toThrow()
  }
})
test("acknowledged prerequisites must retain their exact applied outcomes and original entries", () => {
  const f = planOccurrenceCohortResolutionFixture(true, true)
  expect(validateLocalRecurringBackup(f.backup, f.source.userId)).toEqual(
    f.backup
  )
  const missing = structuredClone(f.backup)
  missing.stores.syncMetadata = missing.stores.syncMetadata.filter(
    (entry) =>
      entry.key !==
      `operation-outcome:${f.source.entries[0].operation.operationId}`
  )
  expect(() => validateLocalRecurringBackup(missing, f.source.userId)).toThrow()
  f.backup.stores.outbox[0].attempts++
  expect(() =>
    validateLocalRecurringBackup(f.backup, f.source.userId)
  ).toThrow()
})
test("duplicate decisions cannot claim the same original operations or reuse a decision identity", () => {
  const f = planOccurrenceCohortResolutionFixture(false)
  const second = planOccurrenceCohortResolution(
    { ...f.request, resolutionId: crypto.randomUUID() },
    f.expected
  )
  f.backup.stores.syncMetadata.push(second)
  expect(() => validateLocalRecurringBackup(f.backup, f.source.userId)).toThrow(
    "multiple recovery"
  )
  const duplicate = planOccurrenceCohortResolutionFixture(false)
  duplicate.backup.stores.syncMetadata.push({
    ...duplicate.record,
    key: `appearance-cohort-resolution:${crypto.randomUUID()}`,
  })
  expect(() =>
    validateLocalRecurringBackup(duplicate.backup, duplicate.source.userId)
  ).toThrow()
})
test("preserved frozen outcomes cannot be replaced by a self-consistent captured DTO", () => {
  const f = planOccurrenceCohortResolutionFixture()
  const outcome = f.backup.stores.syncMetadata.find(
    (value) => "kind" in value && value.kind === "plan-occurrence"
  )
  if (!outcome || !("kind" in outcome) || outcome.kind !== "plan-occurrence")
    throw new Error("Expected fixture outcome")
  outcome.local = {
    ...f.source.occurrences[0],
    content: { title: "Altered frozen evidence", description: "" },
  }
  expect(() => validateLocalRecurringBackup(f.backup, f.source.userId)).toThrow(
    "outcome evidence"
  )
})

test("portable multi-slot evidence remains valid through every production result projection", () => {
  const f = planOccurrenceCohortResolutionFixture()
  const senderId = crypto.randomUUID()
  const remote = new Map(
    f.expected.slots.map((slot) => [slot.occurrenceId, slot.remote])
  )
  for (const [index, replacement] of f.record.replacements.entries()) {
    const id = replacement.operation.command.occurrenceId
    const planned = planRemotePlanOccurrenceOperation({
      userId: f.source.userId,
      timestamp: f.request.createdAt,
      operation: replacement.operation,
      series: f.source.series,
      current: remote.get(id),
    })
    if (planned.status !== "changes")
      throw new Error("Expected remote replacement effects")
    remote.set(id, planned.record)
    const entries = f.backup.stores.outbox.map((entry) =>
      entry.operation.operationId === replacement.operation.operationId
        ? outboxEntrySchema.parse({
            ...entry,
            state: "sending",
            attempts: entry.attempts + 1,
            lease: { ownerId: senderId, expiresAt: "2026-10-19T17:01:00.000Z" },
          })
        : entry
    )
    const result = planLocalPlanOccurrenceResult({
      userId: f.source.userId,
      series: f.source.series,
      local:
        f.backup.stores.occurrences.find((record) => record.id === id) ?? null,
      shadows: f.backup.stores.remoteShadows,
      entries,
      existingOutcome: null,
      submission: {
        operation: replacement.operation,
        senderId,
        result: {
          kind: "plan-occurrence",
          userId: f.source.userId,
          outcome: {
            status: "applied",
            operationId: replacement.operation.operationId,
            sequence: index + 1,
            seriesRevision: f.source.series.revision,
            occurrence: planned.record,
          },
        },
      },
    })
    f.backup.stores.outbox = result.entries
    f.backup.stores.remoteShadows = result.shadows
    const local = result.local
    if (local)
      f.backup.stores.occurrences = f.backup.stores.occurrences.map((record) =>
        record.id === id ? local : record
      )
    f.backup.stores.syncMetadata.push(result.outcome)
    expect(validateLocalRecurringBackup(f.backup, f.source.userId)).toEqual(
      f.backup
    )
  }
  expect(
    f.backup.stores.outbox.filter((entry) => entry.state === "acknowledged")
  ).toHaveLength(4)
  expect(
    f.backup.stores.outbox.filter((entry) => entry.state === "superseded")
  ).toHaveLength(3)
  expect(f.backup.stores.occurrences).toEqual([...remote.values()])
})
