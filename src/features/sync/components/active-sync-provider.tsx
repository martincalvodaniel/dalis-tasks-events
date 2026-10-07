"use client"

import type { ReactNode } from "react"
import { useSyncEngine } from "@/features/sync/hooks/use-sync-engine"
import { SyncContext } from "@/features/sync/sync-context"
import type { LocalAccount } from "@/features/workspace/local-account"

export function ActiveSyncProvider({
  account,
  children,
}: {
  account: LocalAccount
  children: ReactNode
}) {
  const state = useSyncEngine(account)
  return <SyncContext value={state}>{children}</SyncContext>
}
