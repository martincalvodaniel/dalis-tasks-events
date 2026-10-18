"use client"

import { activeProductSyncProtocol } from "@/config/common-plan-release"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { planCategoryResolutionRequestSchema } from "@/schemas/plan-category-resolution"
import { entityIdSchema } from "@/schemas/primitives"

export async function readPlanCategoryIncidentComparison(
  account: Pick<LocalAccount, "userId" | "epoch">,
  operationIdInput: string
) {
  if (activeProductSyncProtocol !== 6)
    throw new Error("Joint recovery requires the active personal scope")
  const operationId = entityIdSchema.parse(operationIdInput)
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    await requireActiveAccount(account)
    const snapshot = await store.readPlanCategoryIncidentSnapshot(operationId)
    await requireActiveAccount(account)
    return snapshot
  } finally {
    store.close()
  }
}

export async function resolvePlanCategoryIncident(
  account: Pick<LocalAccount, "userId" | "epoch">,
  input: unknown
) {
  if (activeProductSyncProtocol !== 6)
    throw new Error("Joint recovery requires the active personal scope")
  const request = planCategoryResolutionRequestSchema.parse(input)
  if (request.userId !== account.userId)
    throw new Error("Joint decision belongs to another account")
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    await requireActiveAccount(account)
    const result = await store.resolvePlanCategoryIncident(request)
    await requireActiveAccount(account)
    return result
  } finally {
    store.close()
  }
}
