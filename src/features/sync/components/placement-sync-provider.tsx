"use client"

import type { ReactNode } from "react"
import { usePlacementSyncEngine } from "@/features/sync/hooks/use-placement-sync-engine"
import { SyncContext } from "@/features/sync/sync-context"
import type { LocalAccount } from "@/features/workspace/local-account"

export function PlacementSyncProvider({
  account,
  children,
}: {
  account: LocalAccount
  children: ReactNode
}) {
  const state = usePlacementSyncEngine(account)
  return <SyncContext value={state}>{children}</SyncContext>
}
