"use client"

import { activeProductSyncProtocol } from "@/config/common-plan-release"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { planOccurrenceCopyRequestSchema } from "@/schemas/plan-occurrence-copy"

export async function resolvePlanOccurrenceCopy(
  account: Pick<LocalAccount, "userId" | "epoch">,
  input: unknown
) {
  if (activeProductSyncProtocol !== 6)
    throw new Error("Appearance copy requires the active settings scope")
  const request = planOccurrenceCopyRequestSchema.parse(input)
  if (request.userId !== account.userId)
    throw new Error("Appearance copy decision belongs to another account")
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    await requireActiveAccount(account)
    const result = await store.resolvePlanOccurrenceCopy(request)
    await requireActiveAccount(account)
    return result
  } finally {
    store.close()
  }
}
