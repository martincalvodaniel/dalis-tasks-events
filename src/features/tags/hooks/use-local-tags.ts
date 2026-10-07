"use client"

import useSWR from "swr"
import { readLocalTags } from "@/features/tags/local-tags"
import type { LocalAccount } from "@/features/workspace/local-account"

export function useLocalTags(account: LocalAccount) {
  return useSWR(
    ["dalis:local-tags", account.userId, account.epoch],
    () => readLocalTags(account),
    { shouldRetryOnError: false }
  )
}
