"use client"

import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { authClient } from "@/lib/auth/auth-client"
import { accountProfileForUser } from "@/schemas/account-profile"
import type { AccountProfile } from "@/types/account-profile"

type AccountReference = Pick<LocalAccount, "userId" | "epoch">
function cacheKey(userId: string) {
  return `dalis:account-profile:${encodeURIComponent(userId)}`
}

export async function readAccountProfile(
  account: AccountReference
): Promise<AccountProfile | null> {
  await requireActiveAccount(account)
  try {
    const stored = localStorage.getItem(cacheKey(account.userId))
    return stored
      ? accountProfileForUser(JSON.parse(stored), account.userId)
      : null
  } catch {
    return null
  }
}

export async function refreshAccountProfile(
  account: AccountReference
): Promise<AccountProfile | null> {
  await requireActiveAccount(account)
  const response = await authClient.getSession({
    fetchOptions: { timeout: 5000 },
  })
  await requireActiveAccount(account)
  const user = response.data?.user
  if (!user || user.id !== account.userId) return null
  const profile = accountProfileForUser(
    {
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
    },
    account.userId
  )
  if (!profile) return null
  try {
    localStorage.setItem(cacheKey(account.userId), JSON.stringify(profile))
  } catch {
    // Optional presentation storage must never block the workspace.
  }
  return profile
}
