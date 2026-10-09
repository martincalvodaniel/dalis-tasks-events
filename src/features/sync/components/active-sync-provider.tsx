"use client"

import type { ReactNode } from "react"
import { useMixedSyncEngine } from "@/features/sync/hooks/use-mixed-sync-engine"
import { SyncContext } from "@/features/sync/sync-context"
import type { LocalAccount } from "@/features/workspace/local-account"

export function ActiveSyncProvider({
  account,
  children,
}: {
  account: LocalAccount
  children: ReactNode
}) {
  const state = useMixedSyncEngine(account)
  return <SyncContext value={state}>{children}</SyncContext>
}
