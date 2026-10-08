import { expect, test } from "bun:test"
import { previewLocalBackupImport } from "@/lib/backup/import-preview"
import { maximumBackupBytes } from "@/lib/backup/local-backup"
import { applyItemCommand } from "@/lib/calendar/item-command"
import type { CalendarItem } from "@/types/calendar-item"
import type { LocalBackup } from "@/types/local-backup"

const userId = "backup-preview-test"
const now = "2026-10-08T00:00:00.000Z"
const metadata = {
  revision: 0,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
}

function task(): CalendarItem {
  return applyItemCommand(
    null,
    {
      type: "item.create",
      itemId: crypto.randomUUID(),
      input: {
        kind: "task",
        title: "Preserved task",
        description: "",
        scheduledDate: "2026-10-08",
        status: "in_progress",
        checklist: [],
        recurrence: null,
      },
    },
    userId,
    now
  )
}

function fixture(): LocalBackup {
  const item = task()
  const tagId = crypto.randomUUID()
  const operationId = crypto.randomUUID()
  return {
    format: "dalis-local-backup",
    version: 1,
    protocolVersion: 1,
    databaseVersion: 2,
    userId,
    exportedAt: now,
    stores: {
      items: [item],
      occurrences: [
        {
          id: `${item.id}:2026-10-08`,
          seriesId: item.id,
          slotKey: "2026-10-08",
          kind: "task",
          cancelled: true,
          scheduledDate: "2026-10-08",
          status: "not_started",
          checklist: [],
          completedAt: null,
          ...metadata,
        },
      ],
      tags: [
        {
          id: tagId,
          userId,
          name: "Personal",
          normalizedName: "personal",
          color: "#00aa99",
          position: 0,
          ...metadata,
        },
      ],
      itemViews: [
        { itemId: item.id, userId, primaryTagId: tagId, ...metadata },
      ],
      taskPlacements: [
        {
          userId,
          occurrenceId: item.id,
          scope: "day",
          date: "2026-10-08",
          tagId,
          position: 0,
          ...metadata,
        },
      ],
      settings: [
        {
          userId,
          timeZone: "Europe/Madrid",
          weekStartsOn: 1,
          locale: "es-ES",
          ...metadata,
        },
      ],
      memberships: [
        {
          itemId: item.id,
          userId,
          role: "reader",
          revokedAt: null,
          ...metadata,
        },
      ],
      invitations: [
        {
          id: crypto.randomUUID(),
          itemId: item.id,
          ownerId: userId,
          recipientEmail: "recipient@example.test",
          role: "reader",
          status: "pending",
          expiresAt: now,
          ...metadata,
        },
      ],
      outbox: [
        {
          userId,
          entityKey: `item:${item.id}`,
          sequence: 1,
          dependencies: [],
          state: "pending",
          attempts: 0,
          lease: null,
          createdAt: now,
          operation: {
            operationId,
            protocolVersion: 1,
            baseRevision: 0,
            command: { type: "item.delete", itemId: item.id },
          },
        },
      ],
      remoteShadows: [
        { entityKey: `item:${item.id}`, record: { ...item, revision: 5 } },
      ],
      syncMetadata: [
        { key: "outbox-sequence", value: 1 },
        { key: "pull-cursor", after: 3, through: 5 },
      ],
    },
  }
}

test("preview preserves every store as detached evidence without changing snapshots", () => {
  const source = fixture()
  const current = structuredClone(source)
  const before = JSON.stringify(current)
  const preview = previewLocalBackupImport(before, current, userId)
  for (const store of Object.keys(
    source.stores
  ) as (keyof LocalBackup["stores"])[]) {
    expect(preview.stores[store]).toHaveLength(source.stores[store].length)
    expect(
      preview.stores[store].every((row) => row.classification === "identical")
    ).toBe(true)
  }
  expect(preview.stores.items[0].support).toBe("simple_item")
  expect(preview.stores.tags[0].support).toBe("unsupported")
  for (const store of [
    "outbox",
    "remoteShadows",
    "syncMetadata",
    "memberships",
    "invitations",
  ] as const)
    expect(
      preview.stores[store].every((row) => row.support === "evidence_only")
    ).toBe(true)
  const row = preview.stores.items[0]
  if (!("title" in row.source)) throw new Error("Fixture item missing")
  row.source.title = "Changed preview only"
  expect(JSON.stringify(current)).toBe(before)
  expect(JSON.stringify(source)).toBe(before)
})

test("preview classifies identity duplicates, changed metadata and all tombstone combinations", () => {
  const source = fixture()
  const current = structuredClone(source)
  source.stores.items = Array.from({ length: 6 }, task)
  const [fresh, same, changed, sourceDeleted, currentDeleted, bothDeleted] =
    source.stores.items
  sourceDeleted.deletedAt = now
  bothDeleted.deletedAt = now
  current.stores.items = [
    structuredClone(same),
    { ...changed, revision: 8 },
    { ...sourceDeleted, deletedAt: null },
    { ...currentDeleted, deletedAt: now },
    structuredClone(bothDeleted),
    task(),
  ]
  const preview = previewLocalBackupImport(
    JSON.stringify(source),
    current,
    userId
  )
  const rows = new Map(preview.stores.items.map((row) => [row.key, row]))
  for (const [item, classification] of [
    [fresh, "new"],
    [same, "identical"],
    [changed, "changed"],
    [sourceDeleted, "source_deleted"],
    [currentDeleted, "current_deleted"],
    [bothDeleted, "both_deleted"],
  ] as const)
    expect(rows.get(item.id)?.classification).toBe(classification)
  expect(rows.size).toBe(6)
  expect(current.stores.items).toHaveLength(6)
  expect(rows.get(fresh.id)?.current).toBeNull()
  const reversed = structuredClone(source)
  reversed.stores.items.reverse()
  expect(
    previewLocalBackupImport(JSON.stringify(reversed), current, userId)
  ).toEqual(preview)
})

test("unsupported series and birthdays remain visible alongside simple events", () => {
  const source = fixture()
  const recurring = task()
  if (recurring.kind !== "task") throw new Error("Fixture task missing")
  recurring.recurrence = {
    frequency: "daily",
    anchorDate: recurring.scheduledDate,
    timeZone: "Europe/Madrid",
    interval: 1,
    end: { type: "never" },
  }
  source.stores.items.push(
    recurring,
    {
      id: crypto.randomUUID(),
      ownerId: userId,
      kind: "birthday",
      title: "Birthday",
      description: "",
      month: 2,
      day: 29,
      birthYear: null,
      timeZone: "Europe/Madrid",
      ...metadata,
    },
    {
      id: crypto.randomUUID(),
      ownerId: userId,
      kind: "event",
      title: "Appointment",
      description: "",
      schedule: {
        mode: "all_day",
        startDate: "2026-10-08",
        endDateExclusive: "2026-10-09",
      },
      recurrence: null,
      ...metadata,
    }
  )
  const current = fixture()
  current.stores.items = []
  const preview = previewLocalBackupImport(
    JSON.stringify(source),
    current,
    userId
  )
  expect(
    preview.stores.items.filter((row) => row.support === "unsupported")
  ).toHaveLength(2)
  expect(
    preview.stores.items.filter((row) => row.support === "simple_item")
  ).toHaveLength(2)
  expect(
    preview.stores.items.every((row) => row.classification === "new")
  ).toBe(true)
})

test("preview rejects invalid accounts, versions, duplicates, histories and byte bounds before returning rows", () => {
  const source = fixture()
  const current = structuredClone(source)
  const json = JSON.stringify(source)
  expect(() => previewLocalBackupImport(json, current, "other")).toThrow()
  expect(() => previewLocalBackupImport("{", current, userId)).toThrow()
  expect(() =>
    previewLocalBackupImport(
      " ".repeat(maximumBackupBytes + 1),
      current,
      userId
    )
  ).toThrow("size limit")
  for (const invalid of [
    { ...source, version: 99 },
    { ...source, userId: "other" },
    {
      ...source,
      stores: {
        ...source.stores,
        items: [...source.stores.items, source.stores.items[0]],
      },
    },
    { ...source, stores: { ...source.stores, syncMetadata: [] } },
  ]) {
    expect(() =>
      previewLocalBackupImport(JSON.stringify(invalid), current, userId)
    ).toThrow()
    expect(() => previewLocalBackupImport(json, invalid, userId)).toThrow()
  }
})
