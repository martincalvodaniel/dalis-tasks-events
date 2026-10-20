"use client"

import { activeProductSyncProtocol } from "@/config/common-plan-release"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { mixedPlacementResolutionRequestSchema } from "@/schemas/mixed-placement-resolution"
import { entityIdSchema } from "@/schemas/primitives"

export async function readMixedPlacementIncidentComparison(
  account: Pick<LocalAccount, "userId" | "epoch">,
  operationIdInput: string
) {
  if (activeProductSyncProtocol !== 6)
    throw new Error(
      "Mixed plan order recovery requires the active personal scope"
    )
  const operationId = entityIdSchema.parse(operationIdInput)
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    await requireActiveAccount(account)
    const result = await store.readMixedPlacementIncidentSnapshot(operationId)
    await requireActiveAccount(account)
    return result
  } finally {
    store.close()
  }
}
export async function resolveMixedPlacementIncident(
  account: Pick<LocalAccount, "userId" | "epoch">,
  input: unknown
) {
  if (activeProductSyncProtocol !== 6)
    throw new Error(
      "Mixed plan order recovery requires the active personal scope"
    )
  const request = mixedPlacementResolutionRequestSchema.parse(input)
  if (request.userId !== account.userId)
    throw new Error("Mixed plan order decision belongs to another account")
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    await requireActiveAccount(account)
    const result = await store.resolveMixedPlacementIncident(request)
    await requireActiveAccount(account)
    return result
  } finally {
    store.close()
  }
}
