"use client"

import type { ReactNode } from "react"
import { commonPlanReleaseEnabled } from "@/config/common-plan-release"
import { PlacementSyncProvider } from "@/features/sync/components/placement-sync-provider"
import { PlanSyncProvider } from "@/features/sync/components/plan-sync-provider"
import type { LocalAccount } from "@/features/workspace/local-account"

export function ActiveSyncProvider({
  account,
  children,
}: {
  account: LocalAccount
  children: ReactNode
}) {
  const Provider = commonPlanReleaseEnabled
    ? PlanSyncProvider
    : PlacementSyncProvider
  return <Provider account={account}>{children}</Provider>
}
