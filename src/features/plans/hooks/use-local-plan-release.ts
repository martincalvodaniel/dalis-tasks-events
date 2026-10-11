"use client"

import { useEffect } from "react"
import useSWR from "swr"
import { readLocalPlanRelease } from "@/features/plans/local-plan-release"
import type { LocalAccount } from "@/features/workspace/local-account"
import { subscribeLocalOutboxChanges } from "@/lib/local-db/sync-notifications"

export function useLocalPlanRelease(account: LocalAccount) {
  const { data, error, mutate } = useSWR(
    ["dalis:common-plan-release", account.userId, account.epoch],
    () => readLocalPlanRelease(account),
    { shouldRetryOnError: false, keepPreviousData: false }
  )
  useEffect(
    () =>
      subscribeLocalOutboxChanges(account.userId, () => {
        void mutate().catch(() => undefined)
      }),
    [account.userId, mutate]
  )
  return { data, error, refresh: () => mutate() }
}
