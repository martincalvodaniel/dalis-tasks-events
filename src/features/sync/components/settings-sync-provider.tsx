"use client"
import type { ReactNode } from "react"
import { useSettingsSyncEngine } from "@/features/sync/hooks/use-settings-sync-engine"
import { SyncContext } from "@/features/sync/sync-context"
import type { LocalAccount } from "@/features/workspace/local-account"
export function SettingsSyncProvider({
  account,
  children,
}: {
  account: LocalAccount
  children: ReactNode
}) {
  const state = useSettingsSyncEngine(account)
  return <SyncContext value={state}>{children}</SyncContext>
}
