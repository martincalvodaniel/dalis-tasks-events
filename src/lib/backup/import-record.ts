import { assertBackupOwnership } from "@/lib/backup/backup-ownership"
import { calendarItemToDraft } from "@/lib/calendar/item-draft"
import { backupImportRecordSchema } from "@/schemas/backup-import-record"
import { localBackupSchema } from "@/schemas/local-backup"
import { syncBatchSchema } from "@/schemas/sync"
import type {
  BackupImportPlan,
  BackupImportRecord,
} from "@/types/backup-import"
import type { OutboxEntry } from "@/types/local-sync"

export function buildBackupImportRecord(
  plan: BackupImportPlan
): BackupImportRecord {
  return backupImportRecordSchema.parse({
    key: `backup-import:${plan.request.importId}`,
    importId: plan.request.importId,
    userId: plan.request.userId,
    createdAt: plan.request.createdAt,
    sourceJson: plan.sourceJson,
    copies: plan.copies.map((copy) => ({
      sourceItemId: copy.sourceItemId,
      operation: copy.operation,
    })),
  })
}

export function validateBackupImportEvidence(
  record: BackupImportRecord,
  entries: ReadonlyMap<string, OutboxEntry>,
  userId: string
): void {
  if (record.userId !== userId)
    throw new Error("Import record belongs to another account")
  if (new TextEncoder().encode(record.sourceJson).byteLength > 16 * 1024 * 1024)
    throw new Error("Archived backup exceeds its size limit")
  // Embedded historical archives are opaque evidence, never restored sync state.
  const archive = localBackupSchema.parse(JSON.parse(record.sourceJson))
  if (archive.userId !== userId)
    throw new Error("Archived backup belongs to another account")
  assertBackupOwnership(archive.stores, userId)
  const sources = new Map(archive.stores.items.map((item) => [item.id, item]))
  if (sources.size !== archive.stores.items.length)
    throw new Error("Archived backup has duplicate source items")
  syncBatchSchema.parse({
    operations: record.copies.map((copy) => copy.operation),
  })
  for (const copy of record.copies) {
    const entry = entries.get(copy.operation.operationId)
    if (
      !entry ||
      entry.createdAt !== record.createdAt ||
      JSON.stringify(entry.operation) !== JSON.stringify(copy.operation)
    )
      throw new Error("Import record is missing its exact preserved operation")
    const source = sources.get(copy.sourceItemId)
    const command = copy.operation.command
    if (
      !source ||
      source.kind === "birthday" ||
      source.deletedAt !== null ||
      source.recurrence !== null ||
      command.type !== "item.create"
    )
      throw new Error("Archived import requires a living simple source item")
    const draft = calendarItemToDraft(source)
    if (JSON.stringify(command.input) !== JSON.stringify(draft))
      throw new Error("Import operation does not match its archived source")
  }
}
