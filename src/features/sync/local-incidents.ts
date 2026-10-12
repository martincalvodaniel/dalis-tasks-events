"use client"

import { recurringSyncReleaseEnabled } from "@/config/common-plan-release"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { syncResolutionRequestSchema } from "@/schemas/sync-resolution"

export async function readSyncIncidents(
  account: Pick<LocalAccount, "userId" | "epoch">
) {
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    const incidents = recurringSyncReleaseEnabled
      ? await store.readRecurringIncidentOverview()
      : await store.readIncidentOverview()
    await requireActiveAccount(account)
    return incidents
  } finally {
    store.close()
  }
}

export async function resolveSyncIncident(
  account: Pick<LocalAccount, "userId" | "epoch">,
  input: unknown
) {
  const request = syncResolutionRequestSchema.parse(input)
  if (request.userId !== account.userId)
    throw new Error("Resolution belongs to another account")
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    await requireActiveAccount(account)
    const result = await store.resolveIncident(
      request,
      recurringSyncReleaseEnabled
    )
    await requireActiveAccount(account)
    return result
  } finally {
    store.close()
  }
}
