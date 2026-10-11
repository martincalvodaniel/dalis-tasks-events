"use client"

import {
  encodeLocalBackup,
  encodeLocalRecurringBackup,
  localBackupStoreNames,
  validateLocalBackup,
  validateLocalRecurringBackup,
} from "@/lib/backup/local-backup"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import type { LocalTransactionContext } from "@/lib/local-db/transaction"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { commonPlanLocalReleaseSchema } from "@/schemas/common-plan-local-release"
import { timestampSchema, userIdSchema } from "@/schemas/primitives"
import type { LocalBackup, LocalRecurringBackup } from "@/types/local-backup"

export function queueLocalBackupSnapshot(
  context: Pick<LocalTransactionContext<unknown>, "transaction" | "fail">,
  database: IDBDatabase,
  userIdInput: string,
  exportedAtInput: string,
  onSnapshot: (backup: LocalBackup) => void
): void {
  queueBackupSnapshot(
    context,
    database,
    userIdInput,
    exportedAtInput,
    onSnapshot,
    {
      version: 2,
      validate: validateLocalBackup,
      encode: encodeLocalBackup,
    }
  )
}

export function queueLocalRecurringBackupSnapshot(
  context: Pick<LocalTransactionContext<unknown>, "transaction" | "fail">,
  database: IDBDatabase,
  userId: string,
  exportedAt: string,
  onSnapshot: (backup: LocalRecurringBackup) => void
): void {
  queueBackupSnapshot(context, database, userId, exportedAt, onSnapshot, {
    version: 3,
    validate: validateLocalRecurringBackup,
    encode: encodeLocalRecurringBackup,
  })
}

function queueBackupSnapshot<Backup extends LocalRecurringBackup>(
  context: Pick<LocalTransactionContext<unknown>, "transaction" | "fail">,
  database: IDBDatabase,
  userIdInput: string,
  exportedAtInput: string,
  onSnapshot: (backup: Backup) => void,
  codec: {
    version: 2 | 3
    validate: (input: unknown, userId: string) => Backup
    encode: (input: unknown, userId: string) => string
  }
): void {
  const userId = userIdSchema.parse(userIdInput)
  const exportedAt = timestampSchema.parse(exportedAtInput)
  if (database.name !== localDatabaseName(userId))
    throw new Error("Backup belongs to another account partition")
  const stores: Partial<
    Record<(typeof localBackupStoreNames)[number], unknown[]>
  > = {}
  let remaining = localBackupStoreNames.length
  for (const name of localBackupStoreNames) {
    const request = context.transaction
      .objectStore(name)
      .getAll(undefined, name === "syncMetadata" ? 10002 : 10001)
    request.onsuccess = () => {
      try {
        stores[name] =
          name === "syncMetadata"
            ? request.result.filter((record) => {
                if (record?.key !== "common-plan-release") return true
                const marker = commonPlanLocalReleaseSchema.parse(record)
                if (marker.userId !== userId)
                  throw new Error("Local release belongs to another account")
                return false
              })
            : request.result
        if (--remaining) return
        const backup = codec.validate(
          {
            format: "dalis-local-backup",
            version: codec.version,
            protocolVersion: 1,
            databaseVersion: database.version,
            userId,
            exportedAt,
            stores,
          },
          userId
        )
        codec.encode(backup, userId)
        onSnapshot(backup)
      } catch (error) {
        context.fail(error)
      }
    }
  }
}

export function readLocalBackup(
  database: IDBDatabase,
  userId: string,
  exportedAt: string
): Promise<LocalBackup> {
  return runLocalTransaction(
    database,
    [...localBackupStoreNames],
    "readonly",
    (context) => {
      queueLocalBackupSnapshot(
        context,
        database,
        userId,
        exportedAt,
        context.setResult
      )
    }
  )
}

// Prepared generation-five export. No restore or product caller is connected here.
export function readLocalRecurringBackup(
  database: IDBDatabase,
  userId: string,
  exportedAt: string
): Promise<LocalRecurringBackup> {
  return runLocalTransaction(
    database,
    [...localBackupStoreNames],
    "readonly",
    (context) => {
      queueLocalRecurringBackupSnapshot(
        context,
        database,
        userId,
        exportedAt,
        context.setResult
      )
    }
  )
}
export class LocalBackupReader {
  private constructor(
    readonly userId: string,
    private readonly database: IDBDatabase
  ) {}
  static async open(userIdInput: string): Promise<LocalBackupReader> {
    const userId = userIdSchema.parse(userIdInput)
    return new LocalBackupReader(userId, await openLocalDatabase(userId))
  }
  read(): Promise<LocalBackup> {
    return readLocalBackup(this.database, this.userId, new Date().toISOString())
  }
  close(): void {
    this.database.close()
  }
}
