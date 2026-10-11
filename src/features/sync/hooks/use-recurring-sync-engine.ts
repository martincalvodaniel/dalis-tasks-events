"use client"

import { useMixedSyncEngineWithClient } from "@/features/sync/hooks/use-mixed-sync-engine-core"
import { createMixedSyncClientV5 } from "@/features/sync/mixed-sync-client-v5"
import type { LocalAccount } from "@/features/workspace/local-account"

// Prepared only; connect this with generation-five routes and action retirement after integrated evidence.
export function useRecurringSyncEngine(
  account: Pick<LocalAccount, "userId" | "epoch">
) {
  return useMixedSyncEngineWithClient(account, 5, createMixedSyncClientV5)
}
