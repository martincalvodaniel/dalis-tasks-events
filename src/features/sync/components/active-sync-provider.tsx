"use client"

import type { ReactNode } from "react"
import {
  activeProductSyncProtocol,
  commonPlanReleaseEnabled,
  recurringSyncReleaseEnabled,
} from "@/config/common-plan-release"
import { PlacementSyncProvider } from "@/features/sync/components/placement-sync-provider"
import { PlanSyncProvider } from "@/features/sync/components/plan-sync-provider"
import { RecurringSyncProvider } from "@/features/sync/components/recurring-sync-provider"
import { SettingsSyncProvider } from "@/features/sync/components/settings-sync-provider"
import type { LocalAccount } from "@/features/workspace/local-account"

export function ActiveSyncProvider({
  account,
  children,
}: {
  account: LocalAccount
  children: ReactNode
}) {
  const Provider =
    activeProductSyncProtocol === 6
      ? SettingsSyncProvider
      : recurringSyncReleaseEnabled
        ? RecurringSyncProvider
        : commonPlanReleaseEnabled
          ? PlanSyncProvider
          : PlacementSyncProvider
  return <Provider account={account}>{children}</Provider>
}
