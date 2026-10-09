"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import type { SyncPassResultV2 } from "@/features/sync/coordinator-v2"
import { isAccountSyncCacheKey } from "@/features/sync/manual-sync"
import type { createMixedSyncClientWithTransport } from "@/features/sync/mixed-sync-client-core"
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
  protocol: 2 | 3
  busy: boolean
  result: SyncPassResultV2 | null
}
interface OwnedController extends AccountIdentity {
  protocol: 2 | 3
  scheduler: SyncSchedulerV2
}

// The account-scoped provider owns one scheduler and its listeners.
export function useMixedSyncEngineWithClient(
  { userId, epoch }: AccountIdentity,
  protocol: 2 | 3,
  createClient: (
    account: AccountIdentity
  ) => ReturnType<typeof createMixedSyncClientWithTransport>
) {
  const { mutate } = useSWRConfig()
  const client = useMemo(
    () => createClient({ userId, epoch }),
    [userId, epoch, createClient]
  )
  const { data: summary, error } = useSWR(
    mixedSyncSummaryCacheKey({ userId, epoch }, protocol),
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
    const summaryKey = mixedSyncSummaryCacheKey(account, protocol)
    const incidentKey = ["dalis:sync-incidents", userId, epoch]
    const owns = (state: OwnedPassState | null) =>
      state?.userId === userId &&
      state.epoch === epoch &&
      state.protocol === protocol
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
            protocol,
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
        if (!disposed)
          setPass({ userId, epoch, protocol, busy: false, result: value })
      },
      isAvailable: () =>
        !disposed && navigator.onLine && document.visibilityState !== "hidden",
      now: () => Date.now(),
      schedule: (callback, delayMs) => {
        const timer = setTimeout(callback, delayMs)
        return () => clearTimeout(timer)
      },
    })
    const owner = { userId, epoch, protocol, scheduler }
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
  }, [userId, epoch, protocol, client, mutate])

  const currentPass =
    pass?.userId === userId &&
    pass.epoch === epoch &&
    pass.protocol === protocol
      ? pass
      : null
  return {
    userId,
    epoch,
    summary: summary ?? null,
    error: Boolean(error),
    busy: currentPass?.busy ?? false,
    result: currentPass?.result ?? null,
    synchronize: () => {
      const current = controller.current
      if (
        current?.userId !== userId ||
        current.epoch !== epoch ||
        current.protocol !== protocol
      )
        return undefined
      return current.scheduler.request()
    },
  }
}
