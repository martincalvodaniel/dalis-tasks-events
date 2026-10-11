"use client"

import { planLocalBackupImport } from "@/lib/backup/import-plan"
import { buildBackupImportRecord } from "@/lib/backup/import-record"
import {
  encodeLocalBackup,
  localBackupStoreNames,
  validateLocalBackup,
} from "@/lib/backup/local-backup"
import { queueLocalBackupSnapshot } from "@/lib/local-db/backup"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { notifyLocalOutboxChange } from "@/lib/local-db/sync-notifications"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { backupImportRequestSchema } from "@/schemas/backup-import"
import { commonPlanLocalReleaseSchema } from "@/schemas/common-plan-local-release"
import { outboxEntrySchema, outboxSequenceSchema } from "@/schemas/local-sync"
import { userIdSchema } from "@/schemas/primitives"
import type { LocalBackupImportResult } from "@/types/backup-import"

export function importLocalBackupCopies(
  database: IDBDatabase,
  userIdInput: string,
  input: unknown,
  sourceJson: string
): Promise<LocalBackupImportResult> {
  const userId = userIdSchema.parse(userIdInput)
  const request = backupImportRequestSchema.parse(input)
  if (request.userId !== userId || database.name !== localDatabaseName(userId))
    throw new Error("Import belongs to another account partition")
  encodeLocalBackup(validateLocalBackup(request.expected, userId), userId)
  return runLocalTransaction<LocalBackupImportResult>(
    database,
    [...localBackupStoreNames],
    "readwrite",
    (context) => {
      const release = context.transaction
        .objectStore("syncMetadata")
        .get("common-plan-release")
      queueLocalBackupSnapshot(
        context,
        database,
        userId,
        request.createdAt,
        (current) => {
          const existing = current.stores.syncMetadata.find(
            (record) => record.key === `backup-import:${request.importId}`
          )
          if (existing) {
            if (
              !("importId" in existing) ||
              existing.userId !== userId ||
              existing.createdAt !== request.createdAt ||
              existing.sourceJson !== sourceJson ||
              JSON.stringify(
                existing.copies.map((copy) => ({
                  sourceItemId: copy.sourceItemId,
                  itemId:
                    "itemId" in copy.operation.command
                      ? copy.operation.command.itemId
                      : null,
                  operationId: copy.operation.operationId,
                }))
              ) !== JSON.stringify(request.copies)
            )
              throw new Error(
                "Import identity was reused with different evidence"
              )
            context.setResult({ status: "replayed", record: existing })
            return
          }
          const plan = planLocalBackupImport(request, sourceJson, current)
          if (release.result !== undefined) {
            const marker = commonPlanLocalReleaseSchema.parse(release.result)
            if (
              marker.userId !== userId ||
              plan.copies.some((copy) => copy.item.kind !== "plan")
            )
              throw new Error(
                "Previous-generation copies cannot enter a prepared plan partition"
              )
          }
          const receipt = buildBackupImportRecord(plan)
          const prior = current.stores.syncMetadata.find(
            (record) => record.key === "outbox-sequence"
          )
          const counter = prior
            ? outboxSequenceSchema.parse(prior)
            : { key: "outbox-sequence" as const, value: 0 }
          const entries = plan.copies.map((copy, index) =>
            outboxEntrySchema.parse({
              userId,
              entityKey: `item:${copy.item.id}`,
              operation: copy.operation,
              sequence: counter.value + index + 1,
              dependencies: [],
              state: "pending",
              attempts: 0,
              lease: null,
              createdAt: request.createdAt,
            })
          )
          const nextCounter = outboxSequenceSchema.parse({
            key: "outbox-sequence",
            value: counter.value + entries.length,
          })
          // Validate the complete portable post-state before queuing any mutation.
          encodeLocalBackup(
            {
              ...current,
              stores: {
                ...current.stores,
                items: [
                  ...current.stores.items,
                  ...plan.copies.map((copy) => copy.item),
                ],
                outbox: [...current.stores.outbox, ...entries],
                syncMetadata: [
                  ...current.stores.syncMetadata.filter(
                    (record) => record.key !== "outbox-sequence"
                  ),
                  nextCounter,
                  receipt,
                ],
              },
            },
            userId
          )
          const items = context.transaction.objectStore("items")
          const outbox = context.transaction.objectStore("outbox")
          const metadata = context.transaction.objectStore("syncMetadata")
          for (const copy of plan.copies) items.add(copy.item)
          for (const entry of entries) outbox.add(entry)
          metadata.put(nextCounter)
          metadata.add(receipt)
          context.setResult({ status: "applied", record: receipt })
        }
      )
    }
  ).then((result) => {
    if (result.status === "applied") notifyLocalOutboxChange(userId)
    return result
  })
}

export class LocalBackupImporter {
  private constructor(
    readonly userId: string,
    private readonly database: IDBDatabase
  ) {}
  static async open(userIdInput: string): Promise<LocalBackupImporter> {
    const userId = userIdSchema.parse(userIdInput)
    return new LocalBackupImporter(userId, await openLocalDatabase(userId))
  }
  commit(input: unknown, sourceJson: string): Promise<LocalBackupImportResult> {
    return importLocalBackupCopies(
      this.database,
      this.userId,
      input,
      sourceJson
    )
  }
  close(): void {
    this.database.close()
  }
}
