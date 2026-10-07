"use client"

import type { ReactNode } from "react"
import { ActiveSyncProvider } from "@/features/sync/components/active-sync-provider"
import type { LocalAccount } from "@/features/workspace/local-account"

export function WorkspaceSyncProvider({
  account,
  children,
}: {
  account: LocalAccount | null
  children: ReactNode
}) {
  return account ? (
    <ActiveSyncProvider
      key={`${account.userId}:${account.epoch}`}
      account={account}
    >
      {children}
    </ActiveSyncProvider>
  ) : (
    children
  )
}
