"use client"

import useSWR from "swr"
import { readLocalTasks } from "@/features/tasks/local-tasks"
import type { LocalAccount } from "@/features/workspace/local-account"

export function useLocalTasks(account: LocalAccount) {
  return useSWR(
    ["dalis:local-tasks", account.userId, account.epoch],
    () => readLocalTasks(account),
    { shouldRetryOnError: false }
  )
}
