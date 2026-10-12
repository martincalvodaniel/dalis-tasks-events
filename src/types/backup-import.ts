import type { z } from "zod"
import type {
  backupImportRequestSchema,
  recurringBackupImportRequestSchema,
} from "@/schemas/backup-import"
import type { backupImportRecordSchema } from "@/schemas/backup-import-record"
import type { CalendarItem } from "@/types/calendar-item"
import type { LocalRecurringBackup } from "@/types/local-backup"
import type { SyncOperation } from "@/types/sync"

export type BackupStoreName = keyof LocalRecurringBackup["stores"]
export type BackupRecord =
  LocalRecurringBackup["stores"][BackupStoreName][number]
export type BackupImportItemPolicy = "all_simple" | "common_plans"
export type BackupImportClassification =
  | "new"
  | "identical"
  | "changed"
  | "source_deleted"
  | "current_deleted"
  | "both_deleted"

export type BackupImportRow = {
  key: string
  classification: BackupImportClassification
  support: "simple_item" | "unsupported" | "evidence_only"
  source: BackupRecord
  current: BackupRecord | null
}

export type BackupImportPreview = {
  userId: string
  sourceExportedAt: string
  currentExportedAt: string
  stores: Record<BackupStoreName, BackupImportRow[]>
}

export type BackupImportComparison = {
  sourceJson: string
  expected: LocalRecurringBackup
  preview: BackupImportPreview
}

export type BackupImportRequest =
  | z.infer<typeof backupImportRequestSchema>
  | z.infer<typeof recurringBackupImportRequestSchema>
export type BackupImportRecord = z.infer<typeof backupImportRecordSchema>
export type LocalBackupImportResult = {
  status: "applied" | "replayed"
  record: BackupImportRecord
}
export type BackupImportPlan = {
  request: BackupImportRequest
  sourceJson: string
  copies: {
    sourceItemId: string
    item: CalendarItem
    operation: SyncOperation
  }[]
}
