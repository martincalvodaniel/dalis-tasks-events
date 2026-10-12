"use client"

import { recurringSyncReleaseEnabled } from "@/config/common-plan-release"
import type { LocalAccount } from "@/features/workspace/local-account"
import { readAccountBackup } from "@/features/workspace/local-backup"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { planLocalBackupImport } from "@/lib/backup/import-plan"
import { previewLocalBackupImport } from "@/lib/backup/import-preview"
import {
  LocalBackupImporter,
  readLocalBackupImportPolicy,
} from "@/lib/local-db/backup-import"
import { openLocalDatabase } from "@/lib/local-db/client"
import {
  backupImportPreparationSchema,
  backupImportRequestSchema,
  recurringBackupImportPreparationSchema,
  recurringBackupImportRequestSchema,
} from "@/schemas/backup-import"
import type {
  BackupImportComparison,
  BackupImportItemPolicy,
  BackupImportPlan,
} from "@/types/backup-import"

type AccountIdentity = Pick<LocalAccount, "userId" | "epoch">

export async function readAccountBackupImportPreview(
  account: AccountIdentity,
  sourceJson: string
): Promise<BackupImportComparison> {
  const owner = { userId: account.userId, epoch: account.epoch }
  const expected = await readAccountBackup(owner)
  const database = await openLocalDatabase(owner.userId)
  let policy: BackupImportItemPolicy
  try {
    await requireActiveAccount(owner)
    policy = await readLocalBackupImportPolicy(database, owner.userId)
  } finally {
    database.close()
  }
  const preview = previewLocalBackupImport(
    sourceJson,
    expected,
    owner.userId,
    policy,
    recurringSyncReleaseEnabled
  )
  await requireActiveAccount(owner)
  return { sourceJson, expected, preview }
}

export async function prepareAccountBackupImport(
  account: AccountIdentity,
  input: unknown
): Promise<BackupImportPlan> {
  const owner = { userId: account.userId, epoch: account.epoch }
  const preparation = (
    recurringSyncReleaseEnabled
      ? recurringBackupImportPreparationSchema
      : backupImportPreparationSchema
  ).parse(input)
  const current = await readAccountBackup(owner)
  const plan = planLocalBackupImport(
    {
      userId: owner.userId,
      importId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      expected: preparation.expected,
      copies: preparation.sourceItemIds.map((sourceItemId) => ({
        sourceItemId,
        itemId: crypto.randomUUID(),
        operationId: crypto.randomUUID(),
      })),
    },
    preparation.sourceJson,
    current,
    recurringSyncReleaseEnabled
  )
  await requireActiveAccount(owner)
  return plan
}

export async function commitAccountBackupImport(
  account: AccountIdentity,
  plan: BackupImportPlan
) {
  const owner = { userId: account.userId, epoch: account.epoch }
  const request = (
    recurringSyncReleaseEnabled
      ? recurringBackupImportRequestSchema
      : backupImportRequestSchema
  ).parse(plan.request)
  const sourceJson = plan.sourceJson
  if (request.userId !== owner.userId)
    throw new Error("Import belongs to another account")
  await requireActiveAccount(owner)
  const importer = await LocalBackupImporter.open(owner.userId)
  try {
    await requireActiveAccount(owner)
    const result = recurringSyncReleaseEnabled
      ? await importer.commitRecurring(request, sourceJson)
      : await importer.commit(request, sourceJson)
    await requireActiveAccount(owner)
    return result
  } finally {
    importer.close()
  }
}
