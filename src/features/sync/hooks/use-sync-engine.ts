"use client"

import { useEffect, useRef, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { dispatchSyncOperations } from "@/features/sync/client-action"
import type { SyncPassResult } from "@/features/sync/coordinator"
import { createHttpSyncTransport } from "@/features/sync/http-transport"
import { openLocalSyncRuntime } from "@/features/sync/local-runtime"
import { isAccountSyncCacheKey, SyncAttempt } from "@/features/sync/manual-sync"
import { SyncScheduler } from "@/features/sync/scheduler"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalSyncStore } from "@/lib/local-db/sync-store"

type AccountIdentity = Pick<LocalAccount, "userId" | "epoch">
async function readSummary(account: AccountIdentity) {
  await requireActiveAccount(account)
  const store = await LocalSyncStore.open(account.userId)
  try {
    const summary = await store.readQueueSummary()
    await requireActiveAccount(account)
    return summary
  } finally {
    store.close()
  }
}

export function useSyncEngine({ userId, epoch }: AccountIdentity) {
  const { mutate } = useSWRConfig()
  const { data: summary, error } = useSWR(
    ["dalis:sync-queue", userId, epoch],
    () => readSummary({ userId, epoch }),
    { shouldRetryOnError: false, refreshInterval: 15000 }
  )
  const controller = useRef<SyncScheduler | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SyncPassResult | null>(null)
  useEffect(() => {
    let disposed = false
    let attempt: SyncAttempt | null = null
    const account = { userId, epoch }
    const scheduler = new SyncScheduler({
      run: async () => {
        attempt = new SyncAttempt(
          () =>
            openLocalSyncRuntime(
              account,
              createHttpSyncTransport(userId, dispatchSyncOperations)
            ),
          async () => {
            await requireActiveAccount(account)
            if (disposed) return
            await mutate((key) => isAccountSyncCacheKey(key, userId, epoch))
          }
        )
        setBusy(true)
        try {
          return await attempt.run()
        } finally {
          attempt = null
          if (!disposed) setBusy(false)
        }
      },
      cancel: () => attempt?.stop(),
      onResult: (value) => {
        if (!disposed) setResult(value)
      },
      isAvailable: () =>
        navigator.onLine && document.visibilityState !== "hidden",
      now: () => Date.now(),
      schedule: (callback, delayMs) => {
        const timer = setTimeout(callback, delayMs)
        return () => clearTimeout(timer)
      },
    })
    controller.current = scheduler
    const wake = () => scheduler.wake()
    window.addEventListener("online", wake)
    window.addEventListener("focus", wake)
    document.addEventListener("visibilitychange", wake)
    scheduler.start()
    return () => {
      disposed = true
      scheduler.stop()
      if (controller.current === scheduler) controller.current = null
      window.removeEventListener("online", wake)
      window.removeEventListener("focus", wake)
      document.removeEventListener("visibilitychange", wake)
    }
  }, [userId, epoch, mutate])
  return {
    userId,
    epoch,
    summary: summary ?? null,
    error: Boolean(error),
    busy,
    result,
    synchronize: () => controller.current?.request(),
  }
}
