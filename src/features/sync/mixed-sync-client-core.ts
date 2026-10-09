"use client"

import type { SyncTransportV2 } from "@/features/sync/http-transport-v2"
import type { LocalSyncRuntimeV2 } from "@/features/sync/local-runtime-v2"
import { SyncAttemptV2 } from "@/features/sync/mixed-sync-controls"
import type { LocalAccount } from "@/features/workspace/local-account"
import type { SyncQueueSummaryV2 } from "@/lib/sync/queue-summary-v2"
import { userIdSchema } from "@/schemas/primitives"
import { accountControlSchema } from "@/schemas/workspace"

export type AccountIdentity = Pick<LocalAccount, "userId" | "epoch">
export interface MixedClientPorts {
  requireActive(account: AccountIdentity): Promise<void>
  readSummary(account: AccountIdentity): Promise<SyncQueueSummaryV2>
  openRuntime(
    account: AccountIdentity,
    transport: SyncTransportV2
  ): Promise<LocalSyncRuntimeV2>
  sendOperations(input: unknown): Promise<unknown>
  fetchRequest: typeof fetch
}
// Capture immutable account identity across transport, runtime and refresh.
export function createMixedSyncClientWithTransport(
  input: AccountIdentity,
  ports: MixedClientPorts,
  createTransport: (
    userId: string,
    sendOperations: MixedClientPorts["sendOperations"],
    fetchRequest: typeof fetch
  ) => SyncTransportV2
) {
  const account = Object.freeze({
    userId: userIdSchema.parse(input.userId),
    epoch: accountControlSchema.shape.epoch.parse(input.epoch),
  })
  const transport = createTransport(
    account.userId,
    (request) => ports.sendOperations(request),
    ports.fetchRequest
  )
  return {
    readSummary: () => ports.readSummary(account),
    createAttempt: (refresh: () => Promise<unknown>) =>
      new SyncAttemptV2(
        () => ports.openRuntime(account, transport),
        async () => {
          await ports.requireActive(account)
          await refresh()
          await ports.requireActive(account)
        }
      ),
  }
}
