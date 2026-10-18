"use client"

import { activeProductSyncProtocol } from "@/config/common-plan-release"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { entityIdSchema } from "@/schemas/primitives"
import { tagOrderResolutionRequestSchema } from "@/schemas/tag-order-resolution"

export async function readTagOrderIncidentComparison(
  account: Pick<LocalAccount, "userId" | "epoch">,
  operationIdInput: string
) {
  if (activeProductSyncProtocol !== 6)
    throw new Error(
      "Category order recovery requires the active personal scope"
    )
  const operationId = entityIdSchema.parse(operationIdInput)
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    await requireActiveAccount(account)
    const result = await store.readTagOrderIncidentSnapshot(operationId)
    await requireActiveAccount(account)
    return result
  } finally {
    store.close()
  }
}
export async function resolveTagOrderIncident(
  account: Pick<LocalAccount, "userId" | "epoch">,
  input: unknown
) {
  if (activeProductSyncProtocol !== 6)
    throw new Error(
      "Category order recovery requires the active personal scope"
    )
  const request = tagOrderResolutionRequestSchema.parse(input)
  if (request.userId !== account.userId)
    throw new Error("Category order decision belongs to another account")
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    await requireActiveAccount(account)
    const result = await store.resolveTagOrderIncident(request)
    await requireActiveAccount(account)
    return result
  } finally {
    store.close()
  }
}
