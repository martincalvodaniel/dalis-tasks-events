"use client"

import { activeProductSyncProtocol } from "@/config/common-plan-release"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { placementResolutionRequestSchema } from "@/schemas/placement-resolution"
import { entityIdSchema } from "@/schemas/primitives"

export async function readPlacementIncidentComparison(
  account: Pick<LocalAccount, "userId" | "epoch">,
  operationIdInput: string
) {
  if (activeProductSyncProtocol !== 6)
    throw new Error("Plan order recovery requires the active personal scope")
  const operationId = entityIdSchema.parse(operationIdInput)
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    await requireActiveAccount(account)
    const result = await store.readPlacementIncidentSnapshot(operationId)
    await requireActiveAccount(account)
    return result
  } finally {
    store.close()
  }
}
export async function resolvePlacementIncident(
  account: Pick<LocalAccount, "userId" | "epoch">,
  input: unknown
) {
  if (activeProductSyncProtocol !== 6)
    throw new Error("Plan order recovery requires the active personal scope")
  const request = placementResolutionRequestSchema.parse(input)
  if (request.userId !== account.userId)
    throw new Error("Plan order decision belongs to another account")
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    await requireActiveAccount(account)
    const result = await store.resolvePlacementIncident(request)
    await requireActiveAccount(account)
    return result
  } finally {
    store.close()
  }
}
