"use client"

import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalBackupReader } from "@/lib/local-db/backup"

export async function readAccountBackup(
  account: Pick<LocalAccount, "userId" | "epoch">
) {
  await requireActiveAccount(account)
  const reader = await LocalBackupReader.open(account.userId)
  try {
    const backup = await reader.read()
    await requireActiveAccount(account)
    return backup
  } finally {
    reader.close()
  }
}
