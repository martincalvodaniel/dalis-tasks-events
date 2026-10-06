"use client"

import type { z } from "zod"
import { OFFLINE_ACCOUNT_KEY } from "@/config/pwa"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import {
  accountControlSchema,
  preparedAccountSchema,
} from "@/schemas/workspace"

export const ACCOUNT_CONTROL_DATABASE = "dalis-account-control"
const channelName = "dalis-account-control"
const eventName = "dalis:account-change"
export type AccountControl = z.infer<typeof accountControlSchema>

async function openControlDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ACCOUNT_CONTROL_DATABASE, 1)
    let blocked = false
    request.onupgradeneeded = () => request.result.createObjectStore("control")
    request.onblocked = () => {
      blocked = true
      reject(new Error("Account control database is blocked"))
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close()
      if (blocked) request.result.close()
      else resolve(request.result)
    }
  })
}

function initialControl(): AccountControl {
  let parsed: ReturnType<typeof preparedAccountSchema.safeParse> | null = null
  try {
    const legacy = localStorage.getItem(OFFLINE_ACCOUNT_KEY)
    if (legacy) parsed = preparedAccountSchema.safeParse(JSON.parse(legacy))
  } catch {
    /* Malformed legacy pointers cannot activate a partition. */
  }
  return accountControlSchema.parse({
    version: 1,
    epoch: crypto.randomUUID(),
    userId: parsed?.success ? parsed.data.userId : null,
    preparedAt: parsed?.success ? parsed.data.preparedAt : null,
    logoutPending: false,
  })
}

async function updateControl(
  update: (current: AccountControl) => AccountControl
): Promise<AccountControl> {
  const database = await openControlDatabase()
  try {
    return await runLocalTransaction(
      database,
      ["control"],
      "readwrite",
      (context) => {
        const store = context.transaction.objectStore("control")
        const request = store.get("active")
        request.onsuccess = () => {
          try {
            const current =
              request.result === undefined
                ? initialControl()
                : accountControlSchema.parse(request.result)
            const result = accountControlSchema.parse(update(current))
            store.put(result, "active")
            context.setResult(result)
          } catch (error) {
            context.fail(error)
          }
        }
      }
    )
  } finally {
    database.close()
  }
}

export function readAccountControl(): Promise<AccountControl> {
  return updateControl((current) => current)
}

function notifyAccountChange() {
  window.dispatchEvent(new Event(eventName))
  try {
    const channel = new BroadcastChannel(channelName)
    channel.postMessage({ type: "ACCOUNT_CHANGED" })
    channel.close()
  } catch {
    /* Storage events and focus checks cover browsers without BroadcastChannel. */
  }
  try {
    localStorage.setItem(eventName, crypto.randomUUID())
  } catch {
    /* Account state remains authoritative in IndexedDB. */
  }
}

export async function activatePreparedAccount(
  userId: string,
  preparedAt: string,
  expectedEpoch: string
): Promise<AccountControl> {
  const control = await updateControl((current) => {
    if (current.epoch !== expectedEpoch || current.logoutPending)
      throw new Error("Account preparation was invalidated")
    return { ...current, userId, preparedAt, epoch: crypto.randomUUID() }
  })
  notifyAccountChange()
  return control
}

export async function hideLocalAccount(): Promise<AccountControl> {
  const control = await updateControl((current) => ({
    ...current,
    userId: null,
    preparedAt: null,
    logoutPending: true,
    epoch: crypto.randomUUID(),
  }))
  try {
    localStorage.removeItem(OFFLINE_ACCOUNT_KEY)
  } catch {
    /* A blocked legacy store cannot undo the committed account closure. */
  }
  notifyAccountChange()
  return control
}

export async function completeRemoteLogout(
  expectedEpoch: string
): Promise<AccountControl> {
  const control = await updateControl((current) =>
    current.epoch === expectedEpoch
      ? { ...current, logoutPending: false }
      : current
  )
  notifyAccountChange()
  return control
}

export function subscribeAccountChanges(invalidate: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === eventName || event.key === null) invalidate()
  }
  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(channelName)
    channel.onmessage = invalidate
  } catch {
    /* Storage events remain available. */
  }
  window.addEventListener(eventName, invalidate)
  window.addEventListener("storage", onStorage)
  window.addEventListener("focus", invalidate)
  return () => {
    channel?.close()
    window.removeEventListener(eventName, invalidate)
    window.removeEventListener("storage", onStorage)
    window.removeEventListener("focus", invalidate)
  }
}
