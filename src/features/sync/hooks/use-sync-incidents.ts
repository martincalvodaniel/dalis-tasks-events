"use client"

import useSWR from "swr"
import { readSyncIncidents } from "@/features/sync/local-incidents"
import type { LocalAccount } from "@/features/workspace/local-account"

export function useSyncIncidents(
  { userId, epoch }: Pick<LocalAccount, "userId" | "epoch">,
  enabled: boolean
) {
  return useSWR(
    enabled ? ["dalis:sync-incidents", userId, epoch] : null,
    () => readSyncIncidents({ userId, epoch }),
    {
      shouldRetryOnError: false,
      refreshInterval: 15000,
    }
  )
}
