"use client"

import type { ReactNode } from "react"
import { usePlanSyncEngine } from "@/features/sync/hooks/use-plan-sync-engine"
import { SyncContext } from "@/features/sync/sync-context"
import type { LocalAccount } from "@/features/workspace/local-account"

export function PlanSyncProvider({
  account,
  children,
}: {
  account: LocalAccount
  children: ReactNode
}) {
  const state = usePlanSyncEngine(account)
  return <SyncContext value={state}>{children}</SyncContext>
}
