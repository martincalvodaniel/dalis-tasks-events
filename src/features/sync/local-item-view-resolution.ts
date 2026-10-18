"use client"

import { activeProductSyncProtocol } from "@/config/common-plan-release"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { itemViewResolutionRequestSchema } from "@/schemas/item-view-resolution"
import { entityIdSchema } from "@/schemas/primitives"

export async function readItemViewIncidentComparison(
  account: Pick<LocalAccount, "userId" | "epoch">,
  operationIdInput: string
) {
  if (activeProductSyncProtocol !== 6)
    throw new Error("Assignment recovery requires the active personal scope")
  const operationId = entityIdSchema.parse(operationIdInput)
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    await requireActiveAccount(account)
    const result = await store.readItemViewIncidentSnapshot(operationId)
    await requireActiveAccount(account)
    return result
  } finally {
    store.close()
  }
}
export async function resolveItemViewIncident(
  account: Pick<LocalAccount, "userId" | "epoch">,
  input: unknown
) {
  if (activeProductSyncProtocol !== 6)
    throw new Error("Assignment recovery requires the active personal scope")
  const request = itemViewResolutionRequestSchema.parse(input)
  if (request.userId !== account.userId)
    throw new Error("Assignment decision belongs to another account")
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    await requireActiveAccount(account)
    const result = await store.resolveItemViewIncident(request)
    await requireActiveAccount(account)
    return result
  } finally {
    store.close()
  }
}
