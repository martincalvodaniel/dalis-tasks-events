"use client"

import { requireActivePlanAccount } from "@/features/plans/local-plan-release"
import type { RecurringSyncTransport } from "@/features/sync/http-recurring-transport"
import type { LocalSyncRuntimeV2 } from "@/features/sync/local-runtime-v2"
import { RecurringSyncCoordinator } from "@/features/sync/recurring-coordinator"
import type { LocalAccount } from "@/features/workspace/local-account"
import { LocalMixedSyncStore } from "@/lib/local-db/mixed-sync-store"
import { LocalOutbox } from "@/lib/local-db/outbox"
// Prepared runtime only. Account-control and product partitions cannot share an IndexedDB transaction.
export async function openLocalRecurringSyncRuntime(
  accountInput: Pick<LocalAccount, "userId" | "epoch">,
  transport: RecurringSyncTransport
): Promise<LocalSyncRuntimeV2> {
  return openScopedRecurringRuntime(accountInput, transport, false)
}

export function openLocalSettingsSyncRuntime(
  accountInput: Pick<LocalAccount, "userId" | "epoch">,
  transport: RecurringSyncTransport
): Promise<LocalSyncRuntimeV2> {
  return openScopedRecurringRuntime(accountInput, transport, true)
}

async function openScopedRecurringRuntime(
  accountInput: Pick<LocalAccount, "userId" | "epoch">,
  transport: RecurringSyncTransport,
  allowSettings: boolean
): Promise<LocalSyncRuntimeV2> {
  const account = { userId: accountInput.userId, epoch: accountInput.epoch }
  const requireAccount = requireActivePlanAccount
  await requireAccount(account)
  const opened = await Promise.allSettled([
    LocalOutbox.open(account.userId),
    allowSettings
      ? LocalMixedSyncStore.openSettings(account.userId)
      : LocalMixedSyncStore.openRecurring(account.userId),
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
    throw new Error("Recurring sync resources could not be opened")
  }
  try {
    await requireAccount(account)
  } catch (error) {
    closeOpened()
    throw error
  }
  const outbox = outboxResult.value
  const store = storeResult.value
  let closing: Promise<void> | null = null
  const guard = async () => {
    if (closing) throw new Error("Recurring sync runtime is closing")
    await requireAccount(account)
  }
  const coordinator = new RecurringSyncCoordinator(
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
    allowSettings
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
