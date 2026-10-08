import type { LocalBackup } from "@/types/local-backup"

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
