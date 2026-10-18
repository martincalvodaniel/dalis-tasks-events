import { expect, test } from "bun:test"
import { itemViewResolutionFixture } from "@/lib/backup/item-view-resolution-fixture"
import { validateLocalRecurringBackup } from "@/lib/backup/local-backup"
import { planCategoryResolutionFixture } from "@/lib/backup/plan-category-resolution-fixture"
import {
  captureItemViewResolutionSnapshot,
  planItemViewIncidentResolution,
} from "@/lib/sync/item-view-resolution"
import { outboxEntrySchema } from "@/schemas/local-sync"

function fixture() {
  const joint = planCategoryResolutionFixture(),
    backup = joint.backup()
  const f = itemViewResolutionFixture("note", joint.actor)
  const offset = Math.max(
    ...backup.stores.outbox.map((entry) => entry.sequence)
  )
  const entries = f.input.entries.map((entry) => ({
    ...entry,
    sequence: entry.sequence + offset,
  }))
  const expected = captureItemViewResolutionSnapshot({
    ...f.capture,
    entries,
    incident: { ...f.capture.incident, entry: entries[0], intentions: entries },
  })
  const record = planItemViewIncidentResolution(
    { ...f.request, expected },
    expected
  )
  if (!record.replacement)
    throw new Error("Assignment fixture replacement missing")
  // Preserve independent records and evidence exactly; only global queue sequences differ.
  const combined = {
    ...backup,
    stores: {
      ...backup.stores,
      items: [...backup.stores.items, f.parent],
      tags: [...backup.stores.tags, f.tag],
      itemViews: [...backup.stores.itemViews, record.local],
      outbox: [
        ...backup.stores.outbox,
        ...entries.map((entry) => ({ ...entry, state: "superseded" as const })),
        outboxEntrySchema.parse({
          userId: f.actor,
          entityKey: f.entry.entityKey,
          operation: record.replacement,
          sequence: offset + 3,
          dependencies: [],
          state: "pending",
          attempts: 0,
          lease: null,
          createdAt: record.createdAt,
        }),
      ],
      syncMetadata: [
        ...backup.stores.syncMetadata.filter(
          (value) => value.key !== "outbox-sequence"
        ),
        f.outcome,
        record,
        { key: "outbox-sequence" as const, value: offset + 3 },
      ],
    },
  }
  return { actor: joint.actor, backup: combined, record }
}
test("independent joint and assignment decisions retain distinct global identities and all evidence", () => {
  const f = fixture()
  expect(validateLocalRecurringBackup(f.backup, f.actor)).toEqual(f.backup)
  expect(
    f.backup.stores.syncMetadata.filter((value) => "resolutionId" in value)
  ).toHaveLength(2)
})
test("different metadata prefixes cannot reuse the same decision UUID", () => {
  const f = fixture(),
    joint = f.backup.stores.syncMetadata.find(
      (value) =>
        "resolutionId" in value &&
        value.key.startsWith("plan-category-resolution:")
    )
  if (!joint || !("resolutionId" in joint))
    throw new Error("Joint decision fixture missing")
  const record = f.backup.stores.syncMetadata.find(
    (value) => value.key === f.record.key
  )
  if (!record || !("resolutionId" in record))
    throw new Error("Assignment decision fixture missing")
  record.resolutionId = joint.resolutionId
  record.key = `item-view-resolution:${joint.resolutionId}`
  expect(() => validateLocalRecurringBackup(f.backup, f.actor)).toThrow(
    "duplicate resolution IDs"
  )
})
test("a decision cannot collide with an operation from another preserved cohort", () => {
  const f = fixture(),
    record = f.backup.stores.syncMetadata.find(
      (value) => value.key === f.record.key
    )
  if (!record || !("resolutionId" in record))
    throw new Error("Assignment decision fixture missing")
  record.resolutionId = f.backup.stores.outbox[0].operation.operationId
  record.key = `item-view-resolution:${record.resolutionId}`
  expect(() => validateLocalRecurringBackup(f.backup, f.actor)).toThrow(
    "preserved operation history"
  )
})
