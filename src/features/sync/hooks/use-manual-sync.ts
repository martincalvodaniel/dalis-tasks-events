"use client"

import { useEffect, useRef, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { dispatchSyncOperations } from "@/features/sync/client-action"
import type { SyncPassResult } from "@/features/sync/coordinator"
import { createHttpSyncTransport } from "@/features/sync/http-transport"
import { openLocalSyncRuntime } from "@/features/sync/local-runtime"
import { isAccountSyncCacheKey, SyncAttempt } from "@/features/sync/manual-sync"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalSyncStore } from "@/lib/local-db/sync-store"

async function readSummary(account: LocalAccount) {
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

export function useManualSync(account: LocalAccount) {
  const { mutate } = useSWRConfig()
  const { data: summary, error } = useSWR(
    ["dalis:sync-queue", account.userId, account.epoch],
    () => readSummary(account),
    { shouldRetryOnError: false, refreshInterval: 15000 }
  )
  const current = useRef<SyncAttempt | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SyncPassResult | null>(null)
  const userId = account.userId
  const epoch = account.epoch
  // DeviceSyncSettings is keyed by account epoch; unmount invalidates its attempt.
  useEffect(
    () => () => {
      current.current?.stop()
      current.current = null
    },
    []
  )
  async function synchronize() {
    if (current.current) return
    const attempt = new SyncAttempt(
      () =>
        openLocalSyncRuntime(
          account,
          createHttpSyncTransport(userId, dispatchSyncOperations)
        ),
      async () => {
        await requireActiveAccount(account)
        await mutate((key) => isAccountSyncCacheKey(key, userId, epoch))
      }
    )
    current.current = attempt
    setBusy(true)
    setResult(null)
    try {
      const next = await attempt.run()
      if (current.current === attempt) setResult(next)
    } catch {
      if (current.current === attempt)
        setResult({ status: "retry_later", uploaded: 0, downloaded: 0 })
    } finally {
      if (current.current === attempt) {
        current.current = null
        setBusy(false)
      }
    }
  }
  return {
    summary: summary ?? null,
    error: Boolean(error),
    busy,
    result,
    synchronize,
  }
}
