"use client"

import { OFFLINE_ACCOUNT_KEY } from "@/config/pwa"
import { LocalRepository } from "@/lib/local-db/repository"
import { isOfflineShellReady, prepareOfflineShell } from "@/lib/pwa/client"
import {
  preparedAccountSchema,
  workspaceIdentitySchema,
} from "@/schemas/workspace"

export interface LocalAccount {
  userId: string
  itemCount: number
}

export async function restoreLocalAccount(): Promise<LocalAccount | null> {
  const stored = localStorage.getItem(OFFLINE_ACCOUNT_KEY)
  if (!stored) return null
  const account = preparedAccountSchema.parse(JSON.parse(stored))
  if (!(await isOfflineShellReady()))
    throw new Error("Offline shell is not ready")
  const repository = await LocalRepository.open(account.userId)
  try {
    if (!(await repository.get("settings", account.userId)))
      throw new Error("Local account is incomplete")
    const items = await repository.list("items")
    return { userId: account.userId, itemCount: items.length }
  } finally {
    repository.close()
  }
}

export async function prepareLocalAccount(): Promise<LocalAccount> {
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
    const prepared = preparedAccountSchema.parse({
      version: 1,
      userId: identity.userId,
      preparedAt: timestamp,
    })
    localStorage.setItem(OFFLINE_ACCOUNT_KEY, JSON.stringify(prepared))
    return { userId: identity.userId, itemCount: items.length }
  } finally {
    repository.close()
  }
}
