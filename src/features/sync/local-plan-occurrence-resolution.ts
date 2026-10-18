"use client"

import { activeProductSyncProtocol } from "@/config/common-plan-release"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { planOccurrenceResolutionRequestSchema } from "@/schemas/plan-occurrence-resolution"

export async function resolvePlanOccurrenceIncident(
  account: Pick<LocalAccount, "userId" | "epoch">,
  input: unknown
) {
  if (activeProductSyncProtocol !== 6)
    throw new Error("Appearance recovery requires the active settings scope")
  const request = planOccurrenceResolutionRequestSchema.parse(input)
  if (request.userId !== account.userId)
    throw new Error("Appearance decision belongs to another account")
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    await requireActiveAccount(account)
    const result = await store.resolvePlanOccurrenceIncident(request)
    await requireActiveAccount(account)
    return result
  } finally {
    store.close()
  }
}
