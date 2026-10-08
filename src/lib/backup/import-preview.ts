import {
  decodeLocalBackup,
  encodeLocalBackup,
  localBackupStoreNames,
  validateLocalBackup,
} from "@/lib/backup/local-backup"
import type {
  BackupImportClassification,
  BackupImportPreview,
  BackupImportRow,
  BackupRecord,
  BackupStoreName,
} from "@/types/backup-import"

function recordKey(store: BackupStoreName, record: BackupRecord): string {
  if ("id" in record) return record.id
  if (store === "taskPlacements" && "scope" in record)
    return JSON.stringify([record.occurrenceId, record.scope, record.date])
  if (store === "memberships" && "itemId" in record && "userId" in record)
    return JSON.stringify([record.itemId, record.userId])
  if (store === "itemViews" && "itemId" in record) return record.itemId
  if (store === "settings" && "userId" in record) return record.userId
  if (store === "outbox" && "operation" in record)
    return record.operation.operationId
  if (store === "remoteShadows" && "entityKey" in record)
    return record.entityKey
  if (store === "syncMetadata" && "key" in record) return record.key
  throw new Error("Backup record has no supported identity")
}

function classify(
  source: BackupRecord,
  current: BackupRecord | null
): BackupImportClassification {
  const sourceDeleted = "deletedAt" in source && source.deletedAt !== null
  const currentDeleted =
    current !== null && "deletedAt" in current && current.deletedAt !== null
  if (sourceDeleted && currentDeleted) return "both_deleted"
  if (sourceDeleted) return "source_deleted"
  if (currentDeleted) return "current_deleted"
  if (!current) return "new"
  return JSON.stringify(source) === JSON.stringify(current)
    ? "identical"
    : "changed"
}

function support(
  store: BackupStoreName,
  record: BackupRecord
): BackupImportRow["support"] {
  if (
    store === "items" &&
    "kind" in record &&
    (record.kind === "task" || record.kind === "event") &&
    "recurrence" in record &&
    record.recurrence === null
  )
    return "simple_item"
  if (
    [
      "outbox",
      "remoteShadows",
      "syncMetadata",
      "memberships",
      "invitations",
    ].includes(store)
  )
    return "evidence_only"
  return "unsupported"
}

export function previewLocalBackupImport(
  sourceJson: string,
  currentInput: unknown,
  userId: string
): BackupImportPreview {
  const source = decodeLocalBackup(sourceJson, userId)
  const current = validateLocalBackup(currentInput, userId)
  // The local comparison snapshot must satisfy the same portable byte bound.
  encodeLocalBackup(current, userId)
  const stores = {} as BackupImportPreview["stores"]
  for (const store of localBackupStoreNames) {
    const existing = new Map(
      current.stores[store].map((record) => [recordKey(store, record), record])
    )
    stores[store] = source.stores[store]
      .map((record): BackupImportRow => {
        const key = recordKey(store, record)
        const destination = existing.get(key) ?? null
        return {
          key,
          classification: classify(record, destination),
          support: support(store, record),
          source: record,
          current: destination,
        }
      })
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  }
  return {
    userId: source.userId,
    sourceExportedAt: source.exportedAt,
    currentExportedAt: current.exportedAt,
    stores,
  }
}
