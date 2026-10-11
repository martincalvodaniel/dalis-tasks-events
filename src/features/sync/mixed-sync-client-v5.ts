"use client"

import { requireActivePlanAccount } from "@/features/plans/local-plan-release"
import { dispatchSyncOperationsV5 } from "@/features/sync/client-action-v5"
import {
  createHttpRecurringSyncTransport,
  type RecurringSyncTransport,
} from "@/features/sync/http-recurring-transport"
import { openLocalRecurringSyncRuntime } from "@/features/sync/local-recurring-runtime"
import {
  type AccountIdentity,
  createMixedSyncClientWithTransport,
  type MixedClientPorts,
} from "@/features/sync/mixed-sync-client-core"
import { readRecurringSyncQueueSummary } from "@/features/sync/mixed-sync-summary"

const defaultPorts: MixedClientPorts<RecurringSyncTransport> = {
  requireActive: requireActivePlanAccount,
  readSummary: readRecurringSyncQueueSummary,
  openRuntime: openLocalRecurringSyncRuntime,
  sendOperations: dispatchSyncOperationsV5,
  fetchRequest: fetch,
}

// Negotiation selects the transport and action together; durable intentions stay unchanged.
export function createMixedSyncClientV5(
  input: AccountIdentity,
  ports: MixedClientPorts<RecurringSyncTransport> = defaultPorts
) {
  return createMixedSyncClientWithTransport(
    input,
    ports,
    createHttpRecurringSyncTransport
  )
}
