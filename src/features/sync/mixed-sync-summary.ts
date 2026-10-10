"use client"

import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalMixedSyncStore } from "@/lib/local-db/mixed-sync-store"
import {
  type SyncQueueSummaryV2,
  summarizeSyncQueueV2,
} from "@/lib/sync/queue-summary-v2"
import {
  placementSyncCapabilityPolicy,
  planSyncCapabilityPolicy,
  type SyncCapabilityPolicy,
  syncCapabilityPolicy,
} from "@/lib/sync/sync-capabilities"

type AccountIdentity = Pick<LocalAccount, "userId" | "epoch">
interface MixedSummaryPorts {
  requireActive(account: AccountIdentity): Promise<void>
  openStore(
    userId: string
  ): Promise<Pick<LocalMixedSyncStore, "readQueueState" | "close">>
}
const defaultPorts: MixedSummaryPorts = {
  requireActive: requireActiveAccount,
  openStore: (userId) => LocalMixedSyncStore.open(userId),
}

// Prepared reader; the product hook still reads its legacy summary.
export async function readMixedSyncQueueSummary(
  input: AccountIdentity,
  ports: MixedSummaryPorts = defaultPorts,
  policy: SyncCapabilityPolicy = syncCapabilityPolicy
): Promise<SyncQueueSummaryV2> {
  const account = { userId: input.userId, epoch: input.epoch }
  await ports.requireActive(account)
  const store = await ports.openStore(account.userId)
  try {
    const state = await store.readQueueState()
    const summary = summarizeSyncQueueV2(
      { ...state, userId: account.userId },
      policy
    )
    await ports.requireActive(account)
    return summary
  } finally {
    store.close()
  }
}

export function readPlacementSyncQueueSummary(
  input: AccountIdentity,
  ports: MixedSummaryPorts = defaultPorts
): Promise<SyncQueueSummaryV2> {
  return readMixedSyncQueueSummary(input, ports, placementSyncCapabilityPolicy)
}

export function readPlanSyncQueueSummary(
  input: AccountIdentity,
  ports: MixedSummaryPorts = defaultPorts
): Promise<SyncQueueSummaryV2> {
  return readMixedSyncQueueSummary(input, ports, planSyncCapabilityPolicy)
}
