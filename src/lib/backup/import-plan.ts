import { previewLocalBackupImport } from "@/lib/backup/import-preview"
import {
  validateLocalBackup,
  validateLocalRecurringBackup,
} from "@/lib/backup/local-backup"
import { applyItemCommand } from "@/lib/calendar/item-command"
import { calendarItemToDraft } from "@/lib/calendar/item-draft"
import {
  backupImportRequestSchema,
  recurringBackupImportRequestSchema,
} from "@/schemas/backup-import"
import { entityIdSchema } from "@/schemas/primitives"
import { syncBatchSchema, syncOperationSchema } from "@/schemas/sync"
import type { BackupImportPlan } from "@/types/backup-import"

function collectReservedIds(input: unknown, ids: Set<string>): void {
  if (typeof input === "string") {
    if (entityIdSchema.safeParse(input).success) ids.add(input)
  } else if (Array.isArray(input)) {
    for (const value of input) collectReservedIds(value, ids)
  } else if (input && typeof input === "object") {
    for (const value of Object.values(input)) collectReservedIds(value, ids)
  }
}

export function planLocalBackupImport(
  input: unknown,
  sourceJson: string,
  currentInput: unknown,
  recurring = false
): BackupImportPlan {
  const request = (
    recurring ? recurringBackupImportRequestSchema : backupImportRequestSchema
  ).parse(input)
  const validate = recurring
    ? validateLocalRecurringBackup
    : validateLocalBackup
  const expected = validate(request.expected, request.userId)
  const current = validate(currentInput, request.userId)
  if (JSON.stringify(expected.stores) !== JSON.stringify(current.stores))
    throw new Error("Backup comparison changed before import planning")
  const preview = previewLocalBackupImport(
    sourceJson,
    current,
    request.userId,
    recurring ? "common_plans" : "all_simple",
    recurring
  )
  const rows = new Map(preview.stores.items.map((row) => [row.key, row]))
  const reserved = new Set<string>()
  collectReservedIds(current.stores, reserved)
  collectReservedIds(preview.stores, reserved)
  const identities = [
    request.importId,
    ...request.copies.flatMap((copy) => [copy.itemId, copy.operationId]),
  ]
  if (
    new Set(identities).size !== identities.length ||
    identities.some((id) => reserved.has(id))
  )
    throw new Error("Import identities must be new and distinct")
  const copies = request.copies.map((selection) => {
    const row = rows.get(selection.sourceItemId)
    const source = row?.source
    if (
      row?.support !== "simple_item" ||
      !source ||
      !("kind" in source) ||
      !("recurrence" in source) ||
      source.deletedAt !== null
    )
      throw new Error("Import requires a living non-recurring supported item")
    const operation = syncOperationSchema.parse({
      operationId: selection.operationId,
      protocolVersion: 1,
      baseRevision: 0,
      command: {
        type: "item.create",
        itemId: selection.itemId,
        input: calendarItemToDraft(source),
      },
    })
    if (operation.command.type !== "item.create")
      throw new Error("Import command must create a new identity")
    return {
      sourceItemId: source.id,
      operation,
      item: applyItemCommand(
        null,
        operation.command,
        request.userId,
        request.createdAt
      ),
    }
  })
  syncBatchSchema.parse({ operations: copies.map((copy) => copy.operation) })
  return { request, sourceJson, copies }
}
