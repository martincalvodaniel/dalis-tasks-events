"use client"

import { useEffect } from "react"
import useSWR from "swr"
import {
  readAccountProfile,
  refreshAccountProfile,
} from "@/features/workspace/account-profile"
import type { LocalAccount } from "@/features/workspace/local-account"

export function useAccountProfile(account: LocalAccount | null) {
  const userId = account?.userId
  const epoch = account?.epoch
  const { data, mutate } = useSWR(
    userId && epoch ? ["dalis:account-profile", userId, epoch] : null,
    ([, userId, epoch]) => readAccountProfile({ userId, epoch }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  )
  useEffect(() => {
    if (!userId || !epoch) return
    const reference = { userId, epoch }
    let cancelled = false
    async function refresh() {
      try {
        const profile = await refreshAccountProfile(reference)
        if (profile && !cancelled) await mutate(profile, { revalidate: false })
      } catch {
        // Keep the last validated profile available when the network is absent.
      }
    }
    if (navigator.onLine) void refresh()
    const online = () => void refresh()
    window.addEventListener("online", online)
    return () => {
      cancelled = true
      window.removeEventListener("online", online)
    }
  }, [userId, epoch, mutate])
  return account && data?.userId === account.userId ? data : null
}
