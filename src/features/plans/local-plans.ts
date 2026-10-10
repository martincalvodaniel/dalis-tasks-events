"use client"

import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import type { PlanOccurrenceCommitOptions } from "@/lib/local-db/plan-occurrence-outbox"
import { commitLocalPlanSave } from "@/lib/local-db/plan-outbox"
import { readLocalPlanSnapshot } from "@/lib/local-db/plan-snapshot"
import { compareRank } from "@/lib/ordering/rank"
import {
  type PlanSaveRequest,
  planSaveRequestSchema,
} from "@/schemas/plan-save"
import type {
  LocalItemCommand,
  LocalPlanOccurrenceCommand,
} from "@/types/local-sync"
import type { Plan } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"

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
  const database = await openLocalDatabase(account.userId)
  try {
    const snapshot = await readLocalPlanSnapshot(database, account.userId)
    await requireActiveAccount(account)
    return {
      plans: snapshot.items.filter(
        (item): item is Plan =>
          item.kind === "plan" &&
          item.ownerId === account.userId &&
          !item.deletedAt
      ),
      occurrences: snapshot.occurrences.filter(
        (record): record is PlanOccurrence => record.kind === "plan"
      ),
      views: snapshot.views,
      tags: snapshot.tags.filter((tag) => !tag.deletedAt).sort(compareRank),
      timeZone: snapshot.settings.timeZone,
    }
  } finally {
    database.close()
  }
}

export async function changeLocalPlanOccurrence(
  account: LocalAccount,
  command: LocalPlanOccurrenceCommand,
  options: PlanOccurrenceCommitOptions
) {
  await requireActiveAccount(account)
  const outbox = await LocalOutbox.open(account.userId)
  try {
    await requireActiveAccount(account)
    return await outbox.commitPlanOccurrenceCommand(command, options)
  } finally {
    outbox.close()
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
