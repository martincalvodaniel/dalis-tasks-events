"use client"

import { useMixedSyncEngineWithClient } from "@/features/sync/hooks/use-mixed-sync-engine-core"
import { createMixedSyncClientV3 } from "@/features/sync/mixed-sync-client-v3"
import type { LocalAccount } from "@/features/workspace/local-account"

// Prepared only: the account provider switches together with generation-three routes and action retirement.
export function usePlacementSyncEngine(
  account: Pick<LocalAccount, "userId" | "epoch">
) {
  return useMixedSyncEngineWithClient(account, 3, createMixedSyncClientV3)
}
