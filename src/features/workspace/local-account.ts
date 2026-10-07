"use client"

import { canPrepareOfflineShell } from "@/config/pwa"
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
  offlineReady: boolean
}

export class AccountAuthenticationError extends Error {
  constructor() {
    super("An authorized online session is required")
    this.name = "AccountAuthenticationError"
  }
}

export async function restoreLocalAccount(): Promise<LocalAccount | null> {
  const account = await readAccountControl()
  if (!account.userId || account.logoutPending) return null
  const offlineReady = canPrepareOfflineShell && (await isOfflineShellReady())
  if (canPrepareOfflineShell && !offlineReady)
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
          offlineReady,
        }
      : null
  } finally {
    repository.close()
  }
}

export async function prepareLocalAccount(
  expectedEpoch?: string
): Promise<LocalAccount> {
  const control = expectedEpoch
    ? await readAccountControl()
    : await completePendingRemoteLogout()
  if (
    control.logoutPending ||
    (expectedEpoch && control.epoch !== expectedEpoch)
  )
    throw new Error("Account preparation was invalidated")
  const response = await fetch("/api/sync/identity", {
    credentials: "same-origin",
    cache: "no-store",
  })
  if (response.status === 401) throw new AccountAuthenticationError()
  if (!response.ok) throw new Error("Workspace identity request failed")
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
    if (canPrepareOfflineShell) await prepareOfflineShell()
    const prepared = await activatePreparedAccount(
      identity.userId,
      timestamp,
      control.epoch
    )
    return {
      userId: identity.userId,
      itemCount: items.length,
      epoch: prepared.epoch,
      offlineReady: canPrepareOfflineShell,
    }
  } finally {
    repository.close()
  }
}

export async function loadLocalAccount() {
  let account = await restoreLocalAccount()
  let control = await readAccountControl()
  let authenticationRequired = false
  if (!account && !control.userId && !control.logoutPending) {
    try {
      account = await prepareLocalAccount(control.epoch)
    } catch (error) {
      const current = await readAccountControl()
      if (current.epoch !== control.epoch) {
        return {
          account: null,
          logoutPending: current.logoutPending,
          authenticationRequired: false,
        }
      }
      if (!(error instanceof AccountAuthenticationError)) throw error
      authenticationRequired = true
    }
    control = await readAccountControl()
  }
  return {
    account: account && account.epoch === control.epoch ? account : null,
    logoutPending: control.logoutPending,
    authenticationRequired,
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
