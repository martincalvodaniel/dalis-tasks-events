"use client"

import { activeProductSyncProtocol } from "@/config/common-plan-release"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { canCopyPlanOccurrenceIncident } from "@/lib/sync/plan-occurrence-copy"
import { planOccurrenceCopyRequestSchema } from "@/schemas/plan-occurrence-copy"
import { entityIdSchema } from "@/schemas/primitives"

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

export async function readPlanOccurrenceCopyComparison(
  account: Pick<LocalAccount, "userId" | "epoch">,
  operationIdInput: string
) {
  if (activeProductSyncProtocol !== 6)
    throw new Error("Appearance copy requires the active settings scope")
  const operationId = entityIdSchema.parse(operationIdInput)
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    await requireActiveAccount(account)
    const overview = await store.readSettingsIncidentOverview(),
      current = overview.find(
        (value) =>
          value.kind === "plan-occurrence" &&
          value.incident.entry.operation.operationId === operationId
      )
    if (
      current?.kind !== "plan-occurrence" ||
      !canCopyPlanOccurrenceIncident(current.incident, account.userId)
    )
      throw new Error("Appearance copy has no supported complete comparison")
    await requireActiveAccount(account)
    return current.incident
  } finally {
    store.close()
  }
}
