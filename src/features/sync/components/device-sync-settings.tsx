"use client"

import { useContext } from "react"
import { SyncStatusPanel } from "@/features/sync/components/sync-status-panel"
import { SyncContext } from "@/features/sync/sync-context"
import type { LocalAccount } from "@/features/workspace/local-account"

export function DeviceSyncSettings({ account }: { account: LocalAccount }) {
  const state = useContext(SyncContext)
  if (
    !state ||
    state.userId !== account.userId ||
    state.epoch !== account.epoch
  )
    throw new Error("Sync settings require the current account provider")
  return (
    <SyncStatusPanel
      {...state}
      onSync={() => {
        void state.synchronize()
      }}
    />
  )
}
