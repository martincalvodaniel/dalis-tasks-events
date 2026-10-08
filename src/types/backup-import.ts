import type { z } from "zod"
import type { backupImportRequestSchema } from "@/schemas/backup-import"
import type { backupImportRecordSchema } from "@/schemas/backup-import-record"
import type { CalendarItem } from "@/types/calendar-item"
import type { LocalBackup } from "@/types/local-backup"
import type { SyncOperation } from "@/types/sync"

export type BackupStoreName = keyof LocalBackup["stores"]
export type BackupRecord = LocalBackup["stores"][BackupStoreName][number]
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

export type BackupImportRequest = z.infer<typeof backupImportRequestSchema>
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
