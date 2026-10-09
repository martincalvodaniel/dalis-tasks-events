"use client"

import { useMixedSyncEngineWithClient } from "@/features/sync/hooks/use-mixed-sync-engine-core"
import { createMixedSyncClient } from "@/features/sync/mixed-sync-client"
import type { LocalAccount } from "@/features/workspace/local-account"

export function useMixedSyncEngine(
  account: Pick<LocalAccount, "userId" | "epoch">
) {
  return useMixedSyncEngineWithClient(account, 2, createMixedSyncClient)
}
