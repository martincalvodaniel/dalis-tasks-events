"use client"

import { activeProductSyncProtocol } from "@/config/common-plan-release"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { tagResolutionRequestSchema } from "@/schemas/tag-resolution"

export async function resolveTagIncident(
  account: Pick<LocalAccount, "userId" | "epoch">,
  input: unknown
) {
  if (activeProductSyncProtocol !== 6)
    throw new Error("Tag recovery requires the active personal scope")
  const request = tagResolutionRequestSchema.parse(input)
  if (request.userId !== account.userId)
    throw new Error("Tag decision belongs to another account")
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    await requireActiveAccount(account)
    const result = await store.resolveTagIncident(request)
    await requireActiveAccount(account)
    return result
  } finally {
    store.close()
  }
}
