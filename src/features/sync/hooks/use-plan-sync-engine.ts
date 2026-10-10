"use client"

import { useMixedSyncEngineWithClient } from "@/features/sync/hooks/use-mixed-sync-engine-core"
import { createMixedSyncClientV4 } from "@/features/sync/mixed-sync-client-v4"
import type { LocalAccount } from "@/features/workspace/local-account"

// The account provider selects this hook with generation-four routes and action retirement.
export function usePlanSyncEngine(
  account: Pick<LocalAccount, "userId" | "epoch">
) {
  return useMixedSyncEngineWithClient(account, 4, createMixedSyncClientV4)
}
