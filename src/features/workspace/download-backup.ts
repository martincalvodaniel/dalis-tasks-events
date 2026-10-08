"use client"

import type { LocalAccount } from "@/features/workspace/local-account"
import { readAccountBackup } from "@/features/workspace/local-backup"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { encodeLocalBackup } from "@/lib/backup/local-backup"

export async function downloadAccountBackup(
  account: Pick<LocalAccount, "userId" | "epoch">
): Promise<void> {
  const backup = await readAccountBackup(account)
  const json = encodeLocalBackup(backup, account.userId)
  await requireActiveAccount(account)
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json;charset=utf-8" })
  )
  const link = document.createElement("a")
  let requested = false
  try {
    link.href = url
    link.download = `dalis-backup-${backup.exportedAt.slice(0, 10)}.json`
    document.body.append(link)
    link.click()
    requested = true
  } finally {
    link.remove()
    // Allow the browser to consume the object URL before releasing it.
    if (requested) setTimeout(() => URL.revokeObjectURL(url), 30000)
    else URL.revokeObjectURL(url)
  }
}
