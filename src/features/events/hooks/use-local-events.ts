"use client"

import useSWR from "swr"
import { readLocalEvents } from "@/features/events/local-events"
import type { LocalAccount } from "@/features/workspace/local-account"

export function useLocalEvents(account: LocalAccount) {
  return useSWR(
    ["dalis:local-events", account.userId, account.epoch],
    () => readLocalEvents(account),
    { shouldRetryOnError: false }
  )
}
