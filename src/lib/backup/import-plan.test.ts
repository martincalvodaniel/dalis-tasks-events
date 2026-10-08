import { expect, test } from "bun:test"
import { planLocalBackupImport } from "@/lib/backup/import-plan"
import { validateLocalBackup } from "@/lib/backup/local-backup"
import { applyItemCommand } from "@/lib/calendar/item-command"
import type { BackupImportRequest } from "@/types/backup-import"
import type { LocalBackup } from "@/types/local-backup"

const userId = "backup-import-test"
const originalDate = "2026-10-07T00:00:00.000Z"
const now = "2026-10-08T00:00:00.000Z"
function fixture(): LocalBackup {
  const item = applyItemCommand(
    null,
    {
      type: "item.create",
      itemId: crypto.randomUUID(),
      input: {
        kind: "task",
        title: "Original task",
        description: "Preserve this draft",
        scheduledDate: "2026-10-07",
        status: "completed",
        recurrence: null,
        checklist: [
          { id: crypto.randomUUID(), text: "Finished step", completed: true },
        ],
      },
    },
    userId,
    originalDate
  )
  return {
    format: "dalis-local-backup",
    version: 1,
    protocolVersion: 1,
    databaseVersion: 2,
    userId,
    exportedAt: originalDate,
    stores: {
      items: [{ ...item, revision: 12 }],
      occurrences: [],
      tags: [],
      itemViews: [],
      taskPlacements: [],
      settings: [],
      memberships: [],
      invitations: [],
      outbox: [],
      remoteShadows: [],
      syncMetadata: [],
    },
  }
}
function request(
  source: LocalBackup,
  expected: LocalBackup
): BackupImportRequest {
  return {
    importId: crypto.randomUUID(),
    userId,
    createdAt: now,
    expected,
    copies: source.stores.items.map((item) => ({
      sourceItemId: item.id,
      itemId: crypto.randomUUID(),
      operationId: crypto.randomUUID(),
    })),
  }
}

test("import plans preserve original evidence while creating only new base-zero intentions", () => {
  const source = fixture()
  source.stores.items.push(
    applyItemCommand(
      null,
      {
        type: "item.create",
        itemId: crypto.randomUUID(),
        input: {
          kind: "event",
          title: "All-day event",
          description: "",
          recurrence: null,
          schedule: {
            mode: "all_day",
            startDate: "2026-10-08",
            endDateExclusive: "2026-10-09",
          },
        },
      },
      userId,
      originalDate
    )
  )
  const current = fixture()
  const input = request(source, current)
  const before = JSON.stringify({ source, current, input })
  const sourceJson = JSON.stringify(source, null, 2)
  const plan = planLocalBackupImport(input, sourceJson, current)
  expect(plan.sourceJson).toBe(sourceJson)
  expect(plan.copies).toHaveLength(2)
  for (let index = 0; index < plan.copies.length; index++) {
    const copy = plan.copies[index]
    expect(copy.item.id).toBe(input.copies[index].itemId)
    expect(copy.item.ownerId).toBe(userId)
    expect(copy.item.revision).toBe(0)
    expect(copy.item.deletedAt).toBeNull()
    expect(copy.item.createdAt).toBe(now)
    expect(copy.operation.baseRevision).toBe(0)
    expect(copy.operation.command.type).toBe("item.create")
  }
  const copiedTask = plan.copies[0].item
  const original = source.stores.items[0]
  if (copiedTask.kind !== "task" || original.kind !== "task")
    throw new Error("Fixture task missing")
  expect(copiedTask.checklist).toEqual(original.checklist)
  expect(copiedTask.status).toBe("completed")
  expect(copiedTask.completedAt).toBe(now)
  expect(original.completedAt).toBe(originalDate)
  expect(planLocalBackupImport(input, sourceJson, current)).toEqual(plan)
  copiedTask.title = "Detached projection"
  expect(JSON.stringify({ source, current, input })).toBe(before)
})

test("a destination tombstone can only be recovered under a fresh identity", () => {
  const source = fixture()
  const current = structuredClone(source)
  current.stores.items[0].deletedAt = now
  const input = request(source, current)
  const plan = planLocalBackupImport(input, JSON.stringify(source), current)
  expect(plan.copies[0].item.id).not.toBe(current.stores.items[0].id)
  expect(current.stores.items[0].deletedAt).toBe(now)
  input.copies[0].itemId = current.stores.items[0].id
  expect(() =>
    planLocalBackupImport(input, JSON.stringify(source), current)
  ).toThrow("new and distinct")
})

test("import rejects reused, duplicate and historical identities", () => {
  const source = fixture()
  const current = fixture()
  const input = request(source, current)
  const oldOperationId = crypto.randomUUID()
  const historicalItemId = crypto.randomUUID()
  current.stores.outbox.push({
    userId,
    entityKey: `item:${historicalItemId}`,
    sequence: 1,
    state: "pending",
    attempts: 0,
    dependencies: [],
    lease: null,
    createdAt: originalDate,
    operation: {
      operationId: oldOperationId,
      protocolVersion: 1,
      baseRevision: 2,
      command: { type: "item.delete", itemId: historicalItemId },
    },
  })
  current.stores.syncMetadata.push({ key: "outbox-sequence", value: 1 })
  for (const id of [
    oldOperationId,
    historicalItemId,
    source.stores.items[0].id,
    input.importId,
    input.copies[0].operationId,
  ]) {
    const changed = structuredClone(input)
    changed.copies[0].itemId = id
    expect(() =>
      planLocalBackupImport(changed, JSON.stringify(source), current)
    ).toThrow("new and distinct")
  }
  const duplicated = structuredClone(input)
  duplicated.copies.push(duplicated.copies[0])
  expect(() =>
    planLocalBackupImport(duplicated, JSON.stringify(source), current)
  ).toThrow("distinct source")
})

test("stale comparisons and unsupported or deleted source selections cannot produce intentions", () => {
  const source = fixture()
  const current = fixture()
  const input = request(source, structuredClone(current))
  current.stores.items[0].title = "Edited after comparison"
  expect(() =>
    planLocalBackupImport(input, JSON.stringify(source), current)
  ).toThrow("comparison changed")
  current.stores.items[0].title = input.expected.stores.items[0].title
  current.exportedAt = now
  expect(() =>
    planLocalBackupImport(input, JSON.stringify(source), current)
  ).not.toThrow()
  const deleted = structuredClone(source)
  deleted.stores.items[0].deletedAt = now
  expect(() =>
    planLocalBackupImport(input, JSON.stringify(deleted), current)
  ).toThrow("living non-recurring")
  const recurring = structuredClone(source)
  const item = recurring.stores.items[0]
  if (item.kind !== "task") throw new Error("Fixture task missing")
  item.recurrence = {
    frequency: "daily",
    anchorDate: item.scheduledDate,
    timeZone: "Europe/Madrid",
    interval: 1,
    end: { type: "never" },
  }
  expect(() =>
    planLocalBackupImport(input, JSON.stringify(recurring), current)
  ).toThrow("living non-recurring")
  const missing = structuredClone(input)
  missing.copies[0].sourceItemId = crypto.randomUUID()
  expect(() =>
    planLocalBackupImport(missing, JSON.stringify(source), current)
  ).toThrow("living non-recurring")
  expect(() =>
    planLocalBackupImport(
      { ...input, userId: "other" },
      JSON.stringify(source),
      current
    )
  ).toThrow("another account")
  expect(() =>
    planLocalBackupImport(
      { ...input, grantAccess: true },
      JSON.stringify(source),
      current
    )
  ).toThrow()
})

test("import planning limits selections and the size of new intentions", () => {
  const source = fixture()
  const current = fixture()
  source.stores.items = Array.from(
    { length: 51 },
    () => fixture().stores.items[0]
  )
  expect(() =>
    planLocalBackupImport(
      request(source, current),
      JSON.stringify(source),
      current
    )
  ).toThrow()
  source.stores.items.length = 50
  for (const item of source.stores.items)
    item.description = "\u00f1".repeat(10000)
  expect(() =>
    planLocalBackupImport(
      request(source, current),
      JSON.stringify(source),
      current
    )
  ).toThrow("batch exceeds")
  expect(() =>
    planLocalBackupImport(
      { ...request(source, current), copies: [] },
      JSON.stringify(source),
      current
    )
  ).toThrow()
})

test("cross-generation import retains personal evidence and creates only fresh item intentions", () => {
  const legacy = fixture()
  const tag = {
    id: crypto.randomUUID(),
    userId,
    name: "Preserved category",
    normalizedName: "preserved category",
    color: "#00aa99",
    position: 0,
    revision: 8,
    createdAt: originalDate,
    updatedAt: now,
    deletedAt: now,
  }
  const versioned = validateLocalBackup(
    {
      ...structuredClone(legacy),
      version: 2,
      stores: {
        ...structuredClone(legacy.stores),
        tags: [tag],
        remoteShadows: [
          {
            version: 2,
            kind: "preference",
            entityKey: `tag:${tag.id}`,
            record: { store: "tags", record: tag },
          },
        ],
      },
    },
    userId
  )
  for (const [source, current] of [
    [legacy, versioned],
    [versioned, legacy],
  ] as const) {
    const sourceJson = JSON.stringify(source, null, 2)
    const before = JSON.stringify(current)
    const input = request(source, current)
    const plan = planLocalBackupImport(input, sourceJson, current)
    expect(plan.sourceJson).toBe(sourceJson)
    expect(plan.request.expected).toEqual(current)
    expect(plan.copies).toHaveLength(source.stores.items.length)
    for (const copy of plan.copies) {
      expect(copy.operation.protocolVersion).toBe(1)
      expect(copy.operation.baseRevision).toBe(0)
      expect(copy.operation.command.type).toBe("item.create")
      expect(copy.item.revision).toBe(0)
    }
    expect(JSON.stringify(current)).toBe(before)
  }
  const input = request(legacy, versioned)
  const changed = structuredClone(versioned)
  const shadow = changed.stores.remoteShadows[0]
  if (
    !("kind" in shadow) ||
    shadow.kind !== "preference" ||
    shadow.record.store !== "tags"
  )
    throw new Error("Personal shadow fixture missing")
  shadow.record.record.position = 1
  expect(() =>
    planLocalBackupImport(input, JSON.stringify(legacy), changed)
  ).toThrow("comparison changed")
})
