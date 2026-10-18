import { expect, test } from "bun:test"
import {
  decodeLocalRecurringBackup,
  encodeLocalRecurringBackup,
  validateLocalBackup,
  validateLocalRecurringBackup,
} from "@/lib/backup/local-backup"
import { planCategoryResolutionFixture } from "@/lib/backup/plan-category-resolution-fixture"
import {
  capturePlanCategoryResolutionSnapshot,
  planPlanCategoryIncidentResolution,
} from "@/lib/sync/plan-category-resolution"

for (const choice of ["adopt_remote", "retry_local"] as const)
  test(`joint ${choice} portable roundtrip preserves exact history and rejects legacy readers`, () => {
    const f = planCategoryResolutionFixture(),
      backup = f.backup(choice)
    expect(
      decodeLocalRecurringBackup(
        encodeLocalRecurringBackup(backup, f.actor),
        f.actor
      )
    ).toEqual(backup)
    expect(() => validateLocalBackup(backup, f.actor)).toThrow()
    expect(
      backup.stores.outbox.filter((entry) => entry.state === "superseded")
    ).toHaveLength(3)
    expect(
      backup.stores.outbox.filter((entry) => entry.state === "acknowledged")
    ).toHaveLength(0)
    expect(
      backup.stores.outbox.filter((entry) => entry.state === "pending")
    ).toHaveLength(choice === "retry_local" ? 2 : 0)
  })

test("joint portable retry remains valid after lost response and later unrelated projection edits", () => {
  const f = planCategoryResolutionFixture(),
    backup = f.backup()
  backup.stores.outbox[3].attempts = 1
  backup.stores.items[0].title = "Later local draft"
  backup.stores.itemViews[0].primaryTagId = null
  expect(validateLocalRecurringBackup(backup, f.actor)).toEqual(backup)
  expect(backup.stores.outbox[3].state).toBe("pending")
})

test("joint backup rejects missing originals, outcomes, replacements or receipt without fabricating confirmation", () => {
  const f = planCategoryResolutionFixture()
  for (const index of [0, 1, 2, 3, 4]) {
    const backup = f.backup()
    backup.stores.outbox.splice(index, 1)
    expect(() => validateLocalRecurringBackup(backup, f.actor)).toThrow()
  }
  for (const index of [1, 2]) {
    const backup = f.backup()
    backup.stores.syncMetadata.splice(index, 1)
    expect(() => validateLocalRecurringBackup(backup, f.actor)).toThrow()
  }
})

test("joint backup rejects changed original payload, dependencies, attempts, ordering, date and identities", () => {
  const f = planCategoryResolutionFixture()
  for (const index of [0, 1, 2]) {
    for (const field of [
      "attempts",
      "sequence",
      "createdAt",
      "dependencies",
      "operation",
    ] as const) {
      const backup = f.backup(),
        entry = backup.stores.outbox[index]
      if (field === "attempts") entry.attempts++
      if (field === "sequence") entry.sequence = 10
      if (field === "createdAt") entry.createdAt = "2026-10-18T10:31:00.000Z"
      if (field === "dependencies") entry.dependencies = []
      if (field === "operation")
        entry.operation.operationId = crypto.randomUUID()
      if (field === "dependencies" && index === 0)
        entry.dependencies = [crypto.randomUUID()]
      expect(() => validateLocalRecurringBackup(backup, f.actor)).toThrow()
    }
  }
})

test("joint backup requires exact sequential independent-CAS replacements linked only to new content", () => {
  const f = planCategoryResolutionFixture()
  for (const index of [3, 4]) {
    for (const field of [
      "sequence",
      "dependencies",
      "createdAt",
      "baseRevision",
    ] as const) {
      const backup = f.backup(),
        entry = backup.stores.outbox[index]
      if (field === "sequence") entry.sequence = 10
      if (field === "dependencies")
        entry.dependencies = [f.entry.operation.operationId]
      if (field === "createdAt") entry.createdAt = "2026-10-18T10:31:00.000Z"
      if (field === "baseRevision") entry.operation.baseRevision++
      expect(() => validateLocalRecurringBackup(backup, f.actor)).toThrow()
    }
  }
})

test("joint snapshot cannot replace durable outcome evidence or silently accept external dependents", () => {
  const f = planCategoryResolutionFixture(),
    backup = f.backup()
  const raw = backup.stores.syncMetadata.find((value) => "result" in value)
  if (!raw || !("local" in raw) || Array.isArray(raw.local) || !raw.local)
    throw new Error("Fixture outcome missing")
  raw.local = { ...f.local, title: "Altered original outcome" }
  expect(() => validateLocalRecurringBackup(backup, f.actor)).toThrow(
    "original outcome"
  )
  const other = f.backup()
  other.stores.outbox.push({
    ...f.assignment,
    sequence: 6,
    operation: { ...f.assignment.operation, operationId: crypto.randomUUID() },
  })
  other.stores.syncMetadata[0] = { key: "outbox-sequence", value: 6 }
  expect(() => validateLocalRecurringBackup(other, f.actor)).toThrow(
    "external dependent"
  )
})

test("captured ACK prerequisite requires real preserved applied outcome, never a local supersession", () => {
  const f = planCategoryResolutionFixture()
  const ancestor = {
    ...f.child,
    state: "acknowledged" as const,
    attempts: 1,
    sequence: 1,
    dependencies: [],
    operation: { ...f.child.operation, operationId: crypto.randomUUID() },
  }
  const entries = f.capture.entries.map((entry) => ({
    ...entry,
    sequence: entry.sequence + 1,
    dependencies:
      entry.sequence === 1
        ? [ancestor.operation.operationId]
        : entry.dependencies,
  }))
  const raw = {
    ...f.capture,
    entries: [ancestor, ...entries],
    incident: {
      ...f.capture.incident,
      entry: entries[0],
      intentions: entries.slice(0, 2),
    },
  }
  // A captured DTO can describe an ACK; only backup history can prove it.

  const record = planPlanCategoryIncidentResolution(
    { ...f.request, expected: capturePlanCategoryResolutionSnapshot(raw) },
    raw
  )
  const backup = f.backup()
  backup.stores.outbox = [
    ancestor,
    ...entries.map((entry) => ({ ...entry, state: "superseded" as const })),
    ...backup.stores.outbox
      .slice(3)
      .map((entry) => ({ ...entry, sequence: entry.sequence + 1 })),
  ]
  backup.stores.syncMetadata = [
    { key: "outbox-sequence", value: 6 },
    f.outcome,
    record,
  ]
  expect(() => validateLocalRecurringBackup(backup, f.actor)).toThrow()
  backup.stores.syncMetadata.push({
    ...f.outcome,
    key: `operation-outcome:${ancestor.operation.operationId}`,
    operation: ancestor.operation,
    result: {
      kind: "item",
      outcome: {
        status: "applied",
        operationId: ancestor.operation.operationId,
        item: { ...f.local, revision: 2 },
        sequence: 1,
      },
    },
  })
  expect(validateLocalRecurringBackup(backup, f.actor)).toEqual(backup)
  const changed = structuredClone(backup)
  changed.stores.outbox[0].attempts++
  expect(() => validateLocalRecurringBackup(changed, f.actor)).toThrow(
    "durable ACK"
  )
})
