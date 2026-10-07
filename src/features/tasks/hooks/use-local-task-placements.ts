"use client"

import useSWR from "swr"
import { readLocalTaskPlacements } from "@/features/tasks/local-ordering"
import type { LocalAccount } from "@/features/workspace/local-account"

export function useLocalTaskPlacements(account: LocalAccount) {
  return useSWR(
    ["dalis:local-task-placements", account.userId, account.epoch],
    () => readLocalTaskPlacements(account),
    { shouldRetryOnError: false }
  )
}
