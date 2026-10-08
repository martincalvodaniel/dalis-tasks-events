import { expect, test } from "bun:test"
import { planLocalBackupImport } from "@/lib/backup/import-plan"
import { buildBackupImportRecord } from "@/lib/backup/import-record"
import {
  decodeLocalBackup,
  encodeLocalBackup,
  validateLocalBackup,
} from "@/lib/backup/local-backup"
import { applyItemCommand } from "@/lib/calendar/item-command"
import type { LocalBackup } from "@/types/local-backup"

const userId = "backup-import-record-test"
const now = "2026-10-08T00:00:00.000Z"
function fixture(): LocalBackup {
  const source: LocalBackup = {
    format: "dalis-local-backup",
    version: 1,
    protocolVersion: 1,
    databaseVersion: 2,
    userId,
    exportedAt: now,
    stores: {
      items: [
        applyItemCommand(
          null,
          {
            type: "item.create",
            itemId: crypto.randomUUID(),
            input: {
              kind: "task",
              title: "Preserved original",
              description: "",
              status: "not_started",
              scheduledDate: "2026-10-08",
              checklist: [],
              recurrence: null,
            },
          },
          userId,
          now
        ),
      ],
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
  const sourceJson = JSON.stringify(source)
  const plan = planLocalBackupImport(
    {
      importId: crypto.randomUUID(),
      userId,
      createdAt: now,
      expected: source,
      copies: [
        {
          sourceItemId: source.stores.items[0].id,
          itemId: crypto.randomUUID(),
          operationId: crypto.randomUUID(),
        },
      ],
    },
    sourceJson,
    source
  )
  const record = buildBackupImportRecord(plan)
  source.stores.items.push(plan.copies[0].item)
  source.stores.outbox.push({
    userId,
    entityKey: `item:${plan.copies[0].item.id}`,
    sequence: 1,
    state: "pending",
    attempts: 0,
    lease: null,
    dependencies: [],
    createdAt: now,
    operation: plan.copies[0].operation,
  })
  source.stores.syncMetadata.push(record, { key: "outbox-sequence", value: 1 })
  return source
}

test("import receipts roundtrip inside portable backups without acknowledging intentions", () => {
  const backup = fixture()
  const before = JSON.stringify(backup)
  const result = decodeLocalBackup(encodeLocalBackup(backup, userId), userId)
  expect(result).toEqual(backup)
  expect(result.stores.outbox[0].state).toBe("pending")
  expect(result.stores.syncMetadata.some((record) => "result" in record)).toBe(
    false
  )
  expect(JSON.stringify(backup)).toBe(before)
  const record = result.stores.syncMetadata.find(
    (record) => "importId" in record
  )
  if (!record || !("importId" in record))
    throw new Error("Fixture receipt missing")
  expect(JSON.parse(record.sourceJson).stores.items).toHaveLength(1)
  record.sourceJson = "Changed result only"
  expect(JSON.stringify(backup)).toBe(before)
})

test("receipt validation rejects altered keys, archives, payloads and missing durable operations", () => {
  for (const mutation of [
    "key",
    "account",
    "source",
    "history",
    "payload",
    "timestamp",
    "duplicate",
  ] as const) {
    const backup = fixture()
    const record = backup.stores.syncMetadata.find(
      (record) => "importId" in record
    )
    if (!record || !("importId" in record))
      throw new Error("Fixture receipt missing")
    if (mutation === "key") record.key = `backup-import:${crypto.randomUUID()}`
    if (mutation === "account") {
      const archive = JSON.parse(record.sourceJson)
      archive.userId = "other"
      record.sourceJson = JSON.stringify(archive)
    }
    if (mutation === "source") {
      const archive = JSON.parse(record.sourceJson)
      archive.stores.items[0].title = "Tampered original"
      record.sourceJson = JSON.stringify(archive)
    }
    if (mutation === "history") backup.stores.outbox = []
    if (mutation === "payload") {
      const command = backup.stores.outbox[0].operation.command
      if (command.type !== "item.create")
        throw new Error("Fixture create missing")
      command.input.title = "Tampered operation"
    }
    if (mutation === "timestamp") record.createdAt = "2026-10-09T00:00:00.000Z"
    if (mutation === "duplicate") record.copies.push(record.copies[0])
    expect(() => validateLocalBackup(backup, userId)).toThrow()
  }
})

test("receipt evidence rejects foreign archived records even if the archive account matches", () => {
  const backup = fixture()
  const record = backup.stores.syncMetadata.find(
    (record) => "importId" in record
  )
  if (!record || !("importId" in record))
    throw new Error("Fixture receipt missing")
  const archive = JSON.parse(record.sourceJson)
  archive.stores.items[0].ownerId = "other"
  record.sourceJson = JSON.stringify(archive)
  expect(() => validateLocalBackup(backup, userId)).toThrow("another account")
})
