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

function commonFixture(): LocalBackup {
  const source = fixture()
  source.version = 2
  source.stores.items = (["task", "event", "appointment", "note"] as const).map(
    (variant, index) => {
      const item = applyItemCommand(
        null,
        {
          type: "item.create",
          itemId: crypto.randomUUID(),
          input: {
            kind: "plan",
            variant,
            title: `Imported ${variant}`,
            description: "Keep description and progress",
            status:
              index === 0
                ? "not_started"
                : index === 1
                  ? "in_progress"
                  : "completed",
            schedule:
              index === 0 || index === 3
                ? {
                    mode: "all_day",
                    startDate: "2026-10-07",
                    endDateExclusive: "2026-10-09",
                  }
                : {
                    mode: "timed",
                    localStart: "2026-10-07T11:30",
                    localEnd: index === 1 ? null : "2026-10-07T12:45",
                    timeZone: "Europe/Madrid",
                  },
            checklist: [
              {
                id: crypto.randomUUID(),
                text: "Completed step",
                completed: true,
              },
              {
                id: crypto.randomUUID(),
                text: "Pending step",
                completed: false,
              },
            ],
            recurrence: null,
          },
        },
        userId,
        originalDate
      )
      return { ...item, revision: 37 }
    }
  )
  const tag = {
    id: crypto.randomUUID(),
    userId,
    name: "Original category",
    normalizedName: "original category",
    color: "#2563eb",
    position: 5,
    revision: 8,
    createdAt: originalDate,
    updatedAt: originalDate,
    deletedAt: null,
  }
  source.stores.tags = [tag]
  source.stores.itemViews = source.stores.items.map((item) => ({
    itemId: item.id,
    userId,
    primaryTagId: tag.id,
    revision: 11,
    createdAt: originalDate,
    updatedAt: originalDate,
    deletedAt: null,
  }))
  source.stores.taskPlacements = source.stores.items.map((item, position) => ({
    userId,
    occurrenceId: item.id,
    scope: "day",
    date: "2026-10-07",
    tagId: tag.id,
    position,
    revision: 13,
    createdAt: originalDate,
    updatedAt: originalDate,
    deletedAt: null,
  }))
  return source
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

test("common imports preserve four variants, schedules and progress under fresh identities only", () => {
  const source = commonFixture()
  const current = fixture()
  const input = request(source, current)
  const before = JSON.stringify({ source, current, input })
  const sourceJson = JSON.stringify(source)
  const plan = planLocalBackupImport(input, sourceJson, current)
  expect(plan.copies).toHaveLength(4)
  for (const [index, copy] of plan.copies.entries()) {
    const original = source.stores.items[index]
    const copied = copy.item
    if (original.kind !== "plan" || copied.kind !== "plan")
      throw new Error("Fixture common plan missing")
    expect(copied.variant).toBe(original.variant)
    expect(copied.title).toBe(original.title)
    expect(copied.description).toBe(original.description)
    expect(copied.schedule).toEqual(original.schedule)
    expect(copied.status).toBe(original.status)
    expect(copied.checklist).toEqual(original.checklist)
    expect(copied.recurrence).toBeNull()
    expect(copied.completedAt).toBe(copied.status === "completed" ? now : null)
    expect(copied.id).toBe(input.copies[index].itemId)
    expect(copied.id).not.toBe(original.id)
    expect(copied.ownerId).toBe(userId)
    expect(copied.createdAt).toBe(now)
    expect(copied.updatedAt).toBe(now)
    expect(copied.revision).toBe(0)
    expect(copied.deletedAt).toBeNull()
    expect(copy.operation.operationId).toBe(input.copies[index].operationId)
    expect(copy.operation.protocolVersion).toBe(1)
    expect(copy.operation.baseRevision).toBe(0)
    expect(copy.operation.command.type).toBe("item.create")
    expect(copied).not.toHaveProperty("primaryTagId")
    expect(copied).not.toHaveProperty("position")
    expect(copy).not.toHaveProperty("outcome")
    expect(copy).not.toHaveProperty("state")
  }
  expect(planLocalBackupImport(input, sourceJson, current)).toEqual(plan)
  const first = plan.copies[0].item
  if (first.kind !== "plan") throw new Error("Fixture common plan missing")
  first.checklist[0].text = "Detached checklist"
  expect(JSON.stringify({ source, current, input })).toBe(before)
})

test("common-plan imports reject reused checklist identities, stale state and unsupported sources without changes", () => {
  const source = commonFixture()
  const current = fixture()
  const input = request(source, current)
  const before = JSON.stringify({ source, current, input })
  const first = source.stores.items[0]
  if (first.kind !== "plan") throw new Error("Fixture common plan missing")
  const reused = structuredClone(input)
  reused.copies[0].operationId = first.checklist[0].id
  expect(() =>
    planLocalBackupImport(reused, JSON.stringify(source), current)
  ).toThrow("new and distinct")
  const changed = structuredClone(current)
  changed.stores.items[0].description = "Concurrent destination edit"
  expect(() =>
    planLocalBackupImport(input, JSON.stringify(source), changed)
  ).toThrow("comparison changed")
  for (const kind of ["deleted", "recurring"] as const) {
    const unsupported = structuredClone(source)
    const item = unsupported.stores.items[0]
    if (item.kind !== "plan") throw new Error("Fixture common plan missing")
    if (kind === "deleted") item.deletedAt = now
    else
      item.recurrence = {
        frequency: "daily",
        anchorDate: "2026-10-07",
        timeZone: "Europe/Madrid",
        interval: 1,
        end: { type: "never" },
      }
    const unchanged = JSON.stringify(unsupported)
    expect(() =>
      planLocalBackupImport(input, JSON.stringify(unsupported), current)
    ).toThrow("living non-recurring")
    expect(JSON.stringify(unsupported)).toBe(unchanged)
  }
  expect(JSON.stringify({ source, current, input })).toBe(before)
})
