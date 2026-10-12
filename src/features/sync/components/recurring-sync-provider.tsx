"use client"

import type { ReactNode } from "react"
import { useRecurringSyncEngine } from "@/features/sync/hooks/use-recurring-sync-engine"
import { SyncContext } from "@/features/sync/sync-context"
import type { LocalAccount } from "@/features/workspace/local-account"

export function RecurringSyncProvider({
  account,
  children,
}: {
  account: LocalAccount
  children: ReactNode
}) {
  const state = useRecurringSyncEngine(account)
  return <SyncContext value={state}>{children}</SyncContext>
}
