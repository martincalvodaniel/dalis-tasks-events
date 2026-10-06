"use client"

import { completePendingRemoteLogout } from "@/features/auth/pending-logout"
import { authClient } from "@/lib/auth/auth-client"
import {
  activatePreparedAccount,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { LocalRepository } from "@/lib/local-db/repository"
import { isOfflineShellReady, prepareOfflineShell } from "@/lib/pwa/client"
import { workspaceIdentitySchema } from "@/schemas/workspace"

export interface LocalAccount {
  userId: string
  itemCount: number
  epoch: string
}

export async function restoreLocalAccount(): Promise<LocalAccount | null> {
  const account = await readAccountControl()
  if (!account.userId || account.logoutPending) return null
  if (!(await isOfflineShellReady()))
    throw new Error("Offline shell is not ready")
  const repository = await LocalRepository.open(account.userId)
  try {
    if (!(await repository.get("settings", account.userId)))
      throw new Error("Local account is incomplete")
    const items = await repository.list("items")
    const current = await readAccountControl()
    return current.epoch === account.epoch
      ? {
          userId: account.userId,
          itemCount: items.length,
          epoch: account.epoch,
        }
      : null
  } finally {
    repository.close()
  }
}

export async function prepareLocalAccount(): Promise<LocalAccount> {
  const control = await completePendingRemoteLogout()
  const response = await fetch("/api/sync/identity", {
    credentials: "same-origin",
    cache: "no-store",
  })
  if (!response.ok) throw new Error("An authorized online session is required")
  const identity = workspaceIdentitySchema.parse(await response.json())
  const repository = await LocalRepository.open(identity.userId)
  try {
    const timestamp = new Date().toISOString()
    if (!(await repository.get("settings", identity.userId))) {
      await repository.put("settings", {
        userId: identity.userId,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        weekStartsOn: 1,
        locale: "es-ES",
        revision: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      })
    }
    const items = await repository.list("items")
    await prepareOfflineShell()
    const prepared = await activatePreparedAccount(
      identity.userId,
      timestamp,
      control.epoch
    )
    return {
      userId: identity.userId,
      itemCount: items.length,
      epoch: prepared.epoch,
    }
  } finally {
    repository.close()
  }
}

export async function closeLocalAccount(): Promise<boolean> {
  const control = await hideLocalAccount()
  try {
    const result = await authClient.signOut({ fetchOptions: { timeout: 5000 } })
    if (result.error) return false
    await completeRemoteLogout(control.epoch)
    return true
  } catch {
    return false
  }
}
