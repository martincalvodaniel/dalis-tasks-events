"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import type { SyncPassResultV2 } from "@/features/sync/coordinator-v2"
import { isAccountSyncCacheKey } from "@/features/sync/manual-sync"
import { createMixedSyncClient } from "@/features/sync/mixed-sync-client"
import {
  type SyncAttemptV2,
  SyncSchedulerV2,
} from "@/features/sync/mixed-sync-controls"
import { mixedSyncSummaryCacheKey } from "@/features/sync/sync-summary-cache-key"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { subscribeLocalOutboxChanges } from "@/lib/local-db/sync-notifications"

type AccountIdentity = Pick<LocalAccount, "userId" | "epoch">
interface OwnedPassState extends AccountIdentity {
  busy: boolean
  result: SyncPassResultV2 | null
}
interface OwnedController extends AccountIdentity {
  scheduler: SyncSchedulerV2
}

// The account-scoped provider owns one scheduler and its listeners.
export function useMixedSyncEngine({ userId, epoch }: AccountIdentity) {
  const { mutate } = useSWRConfig()
  const client = useMemo(
    () => createMixedSyncClient({ userId, epoch }),
    [userId, epoch]
  )
  const { data: summary, error } = useSWR(
    mixedSyncSummaryCacheKey({ userId, epoch }, 2),
    () => client.readSummary(),
    {
      shouldRetryOnError: false,
      refreshInterval: 15000,
      keepPreviousData: false,
    }
  )
  const controller = useRef<OwnedController | null>(null)
  const [pass, setPass] = useState<OwnedPassState | null>(null)

  useEffect(() => {
    let disposed = false
    let attempt: SyncAttemptV2 | null = null
    const account = { userId, epoch }
    const summaryKey = mixedSyncSummaryCacheKey(account, 2)
    const incidentKey = ["dalis:sync-incidents", userId, epoch]
    const owns = (state: AccountIdentity | null) =>
      state?.userId === userId && state.epoch === epoch
    const refreshAccount = async () => {
      await requireActiveAccount(account)
      if (disposed) return
      await mutate((key) => isAccountSyncCacheKey(key, userId, epoch))
    }
    const refreshNotification = async () => {
      await requireActiveAccount(account)
      if (disposed) return
      await Promise.all([mutate(summaryKey), mutate(incidentKey)])
    }
    const scheduler = new SyncSchedulerV2({
      run: async () => {
        const current = client.createAttempt(refreshAccount)
        attempt = current
        if (!disposed)
          setPass((previous) => ({
            userId,
            epoch,
            busy: true,
            result: owns(previous) ? (previous?.result ?? null) : null,
          }))
        try {
          return await current.run()
        } finally {
          if (attempt === current) attempt = null
          if (!disposed)
            setPass((previous) =>
              owns(previous) && previous
                ? { ...previous, busy: false }
                : previous
            )
        }
      },
      cancel: () => attempt?.stop(),
      onResult: (value) => {
        if (!disposed) setPass({ userId, epoch, busy: false, result: value })
      },
      isAvailable: () =>
        !disposed && navigator.onLine && document.visibilityState !== "hidden",
      now: () => Date.now(),
      schedule: (callback, delayMs) => {
        const timer = setTimeout(callback, delayMs)
        return () => clearTimeout(timer)
      },
    })
    const owner = { userId, epoch, scheduler }
    controller.current = owner
    const wake = () => scheduler.wake()
    const unsubscribe = subscribeLocalOutboxChanges(userId, () => {
      if (disposed) return
      scheduler.changed()
      void refreshNotification().catch(() => undefined)
    })
    window.addEventListener("online", wake)
    window.addEventListener("focus", wake)
    document.addEventListener("visibilitychange", wake)
    scheduler.start()
    return () => {
      disposed = true
      scheduler.stop()
      unsubscribe()
      if (controller.current === owner) controller.current = null
      window.removeEventListener("online", wake)
      window.removeEventListener("focus", wake)
      document.removeEventListener("visibilitychange", wake)
    }
  }, [userId, epoch, client, mutate])

  const currentPass =
    pass?.userId === userId && pass.epoch === epoch ? pass : null
  return {
    userId,
    epoch,
    summary: summary ?? null,
    error: Boolean(error),
    busy: currentPass?.busy ?? false,
    result: currentPass?.result ?? null,
    synchronize: () => {
      const current = controller.current
      if (current?.userId !== userId || current.epoch !== epoch)
        return undefined
      return current.scheduler.request()
    },
  }
}
