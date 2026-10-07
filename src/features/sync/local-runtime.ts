"use client"

import {
  SyncCoordinator,
  type SyncPassResult,
} from "@/features/sync/coordinator"
import type { SyncTransport } from "@/features/sync/http-transport"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { LocalSyncStore } from "@/lib/local-db/sync-store"

export interface LocalSyncRuntime {
  run(): Promise<SyncPassResult>
  close(): Promise<void>
}

export async function openLocalSyncRuntime(
  account: Pick<LocalAccount, "userId" | "epoch">,
  transport: SyncTransport
): Promise<LocalSyncRuntime> {
  await requireActiveAccount(account)
  const opened = await Promise.allSettled([
    LocalOutbox.open(account.userId),
    LocalRepository.open(account.userId),
    LocalSyncStore.open(account.userId),
  ])
  const [outboxResult, repositoryResult, syncResult] = opened
  if (
    outboxResult.status !== "fulfilled" ||
    repositoryResult.status !== "fulfilled" ||
    syncResult.status !== "fulfilled"
  ) {
    for (const result of opened)
      if (result.status === "fulfilled") result.value.close()
    throw new Error("Local sync resources could not be opened")
  }
  const outbox = outboxResult.value
  const repository = repositoryResult.value
  const sync = syncResult.value
  const coordinator = new SyncCoordinator(account.userId, {
    ...transport,
    isActive: async () => {
      try {
        await requireActiveAccount(account)
        return true
      } catch {
        return false
      }
    },
    readCursor: () => sync.readPullCursor(),
    applyPage: (input) => sync.applyChangesPage(input),
    listEntries: () => outbox.listEntries(),
    readItem: (id) => repository.get("items", id),
    recoverExpiredSends: () => outbox.recoverExpiredSends(),
    claim: (id, sender) => outbox.claim(id, sender, new Date(), 120000),
    release: (id, sender) => outbox.release(id, sender),
    applyResult: (input) => sync.applyOperationResult(input),
  })
  let closing: Promise<void> | null = null
  return {
    run: () => coordinator.run(),
    close: () => {
      if (closing) return closing
      coordinator.stop()
      closing = coordinator
        .run()
        .then(() => undefined)
        .finally(() => {
          outbox.close()
          repository.close()
          sync.close()
        })
      return closing
    },
  }
}
