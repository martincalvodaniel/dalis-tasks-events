"use client"

import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { openLocalDatabase } from "@/lib/local-db/client"
import { commitLocalPlanSave } from "@/lib/local-db/plan-outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import {
  type PlanSaveRequest,
  planSaveRequestSchema,
} from "@/schemas/plan-save"

export async function saveLocalPlan(
  account: LocalAccount,
  input: PlanSaveRequest
) {
  const request = planSaveRequestSchema.parse(input)
  await requireActiveAccount(account)
  const database = await openLocalDatabase(account.userId)
  try {
    await requireActiveAccount(account)
    return await commitLocalPlanSave(database, account.userId, request)
  } finally {
    database.close()
  }
}

export async function readLocalPlans(account: LocalAccount) {
  await requireActiveAccount(account)
  const repository = await LocalRepository.open(account.userId)
  try {
    const [items, views, tags, settings] = await Promise.all([
      repository.list("items"),
      repository.list("itemViews"),
      repository.list("tags"),
      repository.get("settings", account.userId),
    ])
    if (!settings || settings.deletedAt)
      throw new Error("Local settings are unavailable")
    await requireActiveAccount(account)
    return {
      plans: items.filter((item) => item.kind === "plan"),
      views,
      tags,
      timeZone: settings.timeZone,
    }
  } finally {
    repository.close()
  }
}
