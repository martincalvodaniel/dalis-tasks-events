"use client"

import { useMixedSyncEngineWithClient } from "@/features/sync/hooks/use-mixed-sync-engine-core"
import { createMixedSyncClientV6 } from "@/features/sync/mixed-sync-client-v6"
import type { LocalAccount } from "@/features/workspace/local-account"

// Prepared only; connect this with generation-six routes and action retirement after integrated evidence.
export function useSettingsSyncEngine(
  account: Pick<LocalAccount, "userId" | "epoch">
) {
  return useMixedSyncEngineWithClient(account, 6, createMixedSyncClientV6)
}
