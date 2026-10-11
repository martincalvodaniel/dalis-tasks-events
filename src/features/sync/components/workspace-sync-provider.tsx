"use client"

import type { ReactNode } from "react"
import { commonPlanReleaseEnabled } from "@/config/common-plan-release"
import { PlanReleaseBoundary } from "@/features/plans/components/plan-release-boundary"
import { ActiveSyncProvider } from "@/features/sync/components/active-sync-provider"
import type { LocalAccount } from "@/features/workspace/local-account"

export function WorkspaceSyncProvider({
  account,
  children,
}: {
  account: LocalAccount | null
  children: ReactNode
}) {
  const content = account ? (
    <ActiveSyncProvider
      key={`${account.userId}:${account.epoch}`}
      account={account}
    >
      {children}
    </ActiveSyncProvider>
  ) : (
    children
  )
  return account && commonPlanReleaseEnabled ? (
    <PlanReleaseBoundary
      key={`${account.userId}:${account.epoch}`}
      account={account}
    >
      {content}
    </PlanReleaseBoundary>
  ) : (
    content
  )
}
