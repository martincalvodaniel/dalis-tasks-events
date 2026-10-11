"use client"

import { allowsCommonPlanLocalReset } from "@/config/common-plan-reset"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { openLocalDatabase } from "@/lib/local-db/client"
import {
  prepareLocalCommonPlanRelease,
  requireLocalCommonPlanRelease,
  resetLocalCommonPlanContent,
} from "@/lib/local-db/common-plan-local-release"

type AccountIdentity = Pick<LocalAccount, "userId" | "epoch">
export async function readLocalPlanRelease(account: AccountIdentity) {
  await requireActiveAccount(account)
  const database = await openLocalDatabase(account.userId)
  try {
    await requireActiveAccount(account)
    const state = await prepareLocalCommonPlanRelease(
      database,
      account.userId,
      new Date().toISOString()
    )
    await requireActiveAccount(account)
    return state
  } finally {
    database.close()
  }
}
export async function confirmLocalPlanReset(
  account: AccountIdentity,
  operationId: string
) {
  if (!allowsCommonPlanLocalReset(window.location.origin))
    throw new Error("Local content reset is unavailable on this origin")
  await requireActiveAccount(account)
  const database = await openLocalDatabase(account.userId)
  try {
    await requireActiveAccount(account)
    await resetLocalCommonPlanContent(database, account.userId, {
      operationId,
      preparedAt: new Date().toISOString(),
    })
    await requireActiveAccount(account)
  } finally {
    database.close()
  }
}
export async function requireActivePlanAccount(account: AccountIdentity) {
  await requireActiveAccount(account)
  const database = await openLocalDatabase(account.userId)
  try {
    await requireLocalCommonPlanRelease(database, account.userId)
    await requireActiveAccount(account)
  } finally {
    database.close()
  }
}
