"use client"

import {
  SyncCoordinatorV2,
  type SyncPassResultV2,
} from "@/features/sync/coordinator-v2"
import type { SyncTransportV2 } from "@/features/sync/http-transport-v2"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalMixedSyncStore } from "@/lib/local-db/mixed-sync-store"
import { LocalOutbox } from "@/lib/local-db/outbox"
import {
  placementSyncCapabilityPolicy,
  type SyncCapabilityPolicy,
  syncCapabilityPolicy,
} from "@/lib/sync/sync-capabilities"

export interface LocalSyncRuntimeV2 {
  run(): Promise<SyncPassResultV2>
  close(): Promise<void>
}

// Prepared runtime only. Account-control and product partitions cannot share an IndexedDB transaction.
export async function openLocalSyncRuntimeV2(
  accountInput: Pick<LocalAccount, "userId" | "epoch">,
  transport: SyncTransportV2,
  policy: SyncCapabilityPolicy = syncCapabilityPolicy
): Promise<LocalSyncRuntimeV2> {
  const account = { userId: accountInput.userId, epoch: accountInput.epoch }
  await requireActiveAccount(account)
  const opened = await Promise.allSettled([
    LocalOutbox.open(account.userId),
    LocalMixedSyncStore.open(account.userId),
  ])
  const [outboxResult, storeResult] = opened
  const closeOpened = () => {
    for (const result of opened)
      if (result.status === "fulfilled") result.value.close()
  }
  if (
    outboxResult.status !== "fulfilled" ||
    storeResult.status !== "fulfilled"
  ) {
    closeOpened()
    throw new Error("Mixed sync resources could not be opened")
  }
  try {
    await requireActiveAccount(account)
  } catch (error) {
    closeOpened()
    throw error
  }
  const outbox = outboxResult.value
  const store = storeResult.value
  let closing: Promise<void> | null = null
  const guard = async () => {
    if (closing) throw new Error("Mixed sync runtime is closing")
    await requireActiveAccount(account)
  }
  const coordinator = new SyncCoordinatorV2(
    account.userId,
    {
      ...transport,
      isActive: async () => {
        try {
          await guard()
          return !closing
        } catch {
          return false
        }
      },
      readCursor: async () => {
        await guard()
        const value = await store.readPullCursor()
        await guard()
        return value
      },
      readQueueState: async () => {
        await guard()
        const value = await store.readQueueState()
        await guard()
        return value
      },
      recoverExpiredSends: async () => {
        await guard()
        return outbox.recoverExpiredSends()
      },
      claim: async (id, sender) => {
        await guard()
        return outbox.claim(id, sender, new Date(), 120000)
      },
      // Lease cleanup is scoped to the previous partition and sender, including after account closure.
      release: (id, sender) => outbox.release(id, sender),
      applyPage: async (input) => {
        await guard()
        return store.applyChangesPage(input)
      },
      applyResult: async (input) => {
        await guard()
        return store.applyOperationResult(input)
      },
    },
    undefined,
    policy
  )
  return {
    run: () => coordinator.run(),
    close: () => {
      if (closing) return closing
      coordinator.stop()
      closing = coordinator
        .run()
        .then(() => undefined)
        .finally(closeOpened)
      return closing
    },
  }
}

// Prepared only; the generation-three client owns this policy and transport together.
export function openLocalPlacementSyncRuntime(
  account: Pick<LocalAccount, "userId" | "epoch">,
  transport: SyncTransportV2
): Promise<LocalSyncRuntimeV2> {
  return openLocalSyncRuntimeV2(
    account,
    transport,
    placementSyncCapabilityPolicy
  )
}
