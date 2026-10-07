"use client"

import { SyncStatusPanel } from "@/features/sync/components/sync-status-panel"
import { useManualSync } from "@/features/sync/hooks/use-manual-sync"
import type { LocalAccount } from "@/features/workspace/local-account"

export function DeviceSyncSettings({ account }: { account: LocalAccount }) {
  const { synchronize, ...state } = useManualSync(account)
  return (
    <SyncStatusPanel
      {...state}
      onSync={() => {
        void synchronize()
      }}
    />
  )
}
