import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { BackupImportSelection } from "@/features/workspace/components/backup-import-selection"
import { BackupImportSelectionRow } from "@/features/workspace/components/backup-import-selection-row"
import { previewLocalBackupImport } from "@/lib/backup/import-preview"
import { encodeLocalBackup } from "@/lib/backup/local-backup"
import { localBackupSchema } from "@/schemas/local-backup"

const userId = "browser-test-import-selection"
const now = "2026-10-08T00:00:00.000Z"
const items = Array.from({ length: 21 }, (_, index) => ({
  id: crypto.randomUUID(),
  ownerId: userId,
  kind: "task",
  title: `Task ${index}`,
  description: "",
  scheduledDate: "2026-10-08",
  status: "not_started",
  checklist: [],
  recurrence: null,
  completedAt: null,
  revision: 0,
  createdAt: now,
  updatedAt: now,
  deletedAt: index === 0 ? now : null,
}))
const backup = localBackupSchema.parse({
  format: "dalis-local-backup",
  version: 1,
  protocolVersion: 1,
  databaseVersion: 2,
  userId,
  exportedAt: now,
  stores: {
    items,
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
})

test("import selection bounds rendered rows and keeps deleted sources unavailable", () => {
  const preview = previewLocalBackupImport(
    encodeLocalBackup(backup, userId),
    backup,
    userId
  )
  const html = renderToStaticMarkup(
    <BackupImportSelection
      preview={preview}
      selected={[]}
      busy={false}
      onToggle={() => undefined}
    />
  )
  expect((html.match(/type="checkbox"/g) ?? []).length).toBe(20)
  expect(html).toContain("Siguiente")
  expect(html).not.toContain('checked=""')
  const deleted = preview.stores.items.find(
    (row) => "deletedAt" in row.source && row.source.deletedAt
  )
  expect(deleted).toBeDefined()
  const row = renderToStaticMarkup(
    <BackupImportSelectionRow
      row={deleted as NonNullable<typeof deleted>}
      checked={false}
      disabled={false}
      onToggle={() => undefined}
    />
  )
  expect(row).toContain('disabled=""')
  expect(row).toContain("Borrado en ambos")
})
