"use client"

import type { LocalAccount } from "@/features/workspace/local-account"
import { readAccountControl } from "@/lib/local-db/account-control"

export async function requireActiveAccount(account: LocalAccount) {
  const current = await readAccountControl()
  if (
    current.userId !== account.userId ||
    current.epoch !== account.epoch ||
    current.logoutPending
  )
    throw new Error("Local account changed during the operation")
}
