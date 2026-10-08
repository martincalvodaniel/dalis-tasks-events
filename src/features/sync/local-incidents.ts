"use client"

import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalSyncStore } from "@/lib/local-db/sync-store"

export async function readSyncIncidents(
  account: Pick<LocalAccount, "userId" | "epoch">
) {
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    const incidents = await store.readIncidents()
    await requireActiveAccount(account)
    return incidents
  } finally {
    store.close()
  }
}
