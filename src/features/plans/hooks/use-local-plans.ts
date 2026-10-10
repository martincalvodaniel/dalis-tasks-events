"use client"

import useSWR from "swr"
import { readLocalPlans } from "@/features/plans/local-plans"
import type { LocalAccount } from "@/features/workspace/local-account"

export function useLocalPlans(account: LocalAccount) {
  return useSWR(
    ["dalis:local-plans", account.userId, account.epoch],
    () => readLocalPlans(account),
    { shouldRetryOnError: false }
  )
}
