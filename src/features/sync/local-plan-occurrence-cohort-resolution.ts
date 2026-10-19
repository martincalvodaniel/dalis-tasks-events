"use client"

import { activeProductSyncProtocol } from "@/config/common-plan-release"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { planOccurrenceCohortResolutionRequestSchema } from "@/schemas/plan-occurrence-cohort-resolution"
import { entityIdSchema } from "@/schemas/primitives"

export async function readPlanOccurrenceCohortComparison(
  account: Pick<LocalAccount, "userId" | "epoch">,
  operationIdInput: string
) {
  if (activeProductSyncProtocol !== 6)
    throw new Error(
      "Joint appearance recovery requires the active personal scope"
    )
  const operationId = entityIdSchema.parse(operationIdInput)
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    await requireActiveAccount(account)
    const comparison =
      await store.readPlanOccurrenceCohortComparison(operationId)
    await requireActiveAccount(account)
    return comparison
  } finally {
    store.close()
  }
}

export async function resolvePlanOccurrenceCohort(
  account: Pick<LocalAccount, "userId" | "epoch">,
  input: unknown
) {
  if (activeProductSyncProtocol !== 6)
    throw new Error(
      "Joint appearance recovery requires the active personal scope"
    )
  const request = planOccurrenceCohortResolutionRequestSchema.parse(input)
  if (request.userId !== account.userId)
    throw new Error("Joint appearance decision belongs to another account")
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    await requireActiveAccount(account)
    const result = await store.resolvePlanOccurrenceCohort(request)
    await requireActiveAccount(account)
    return result
  } finally {
    store.close()
  }
}
