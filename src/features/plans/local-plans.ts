"use client"

import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { commitLocalPlanSave } from "@/lib/local-db/plan-outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { compareRank } from "@/lib/ordering/rank"
import {
  type PlanSaveRequest,
  planSaveRequestSchema,
} from "@/schemas/plan-save"
import type { LocalItemCommand } from "@/types/local-sync"
import type { Plan } from "@/types/plan-item"

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
      repository.list("itemViews", { includeDeleted: true }),
      repository.list("tags"),
      repository.get("settings", account.userId),
    ])
    if (!settings || settings.deletedAt)
      throw new Error("Local settings are unavailable")
    await requireActiveAccount(account)
    return {
      plans: items.filter((item) => item.kind === "plan"),
      views,
      tags: tags.filter((tag) => !tag.deletedAt).sort(compareRank),
      timeZone: settings.timeZone,
    }
  } finally {
    repository.close()
  }
}

export type PlanProgressCommand = Extract<
  LocalItemCommand,
  { type: "plan.set-status" | "plan.set-checklist-entry" }
>

export async function changeLocalPlanProgress(
  account: LocalAccount,
  command: PlanProgressCommand,
  operationId: string
) {
  await requireActiveAccount(account)
  const outbox = await LocalOutbox.open(account.userId)
  try {
    await requireActiveAccount(account)
    return await outbox.commitItemCommand(command, { operationId })
  } finally {
    outbox.close()
  }
}

export async function deleteLocalPlan(
  account: LocalAccount,
  expected: Plan,
  operationId: string
) {
  await requireActiveAccount(account)
  const outbox = await LocalOutbox.open(account.userId)
  try {
    await requireActiveAccount(account)
    return await outbox.commitItemCommand(
      { type: "item.delete", itemId: expected.id },
      { operationId, expectedItem: expected }
    )
  } finally {
    outbox.close()
  }
}
