"use client"

import { requireActivePlanAccount } from "@/features/plans/local-plan-release"
import { dispatchSyncOperationsV6 } from "@/features/sync/client-action-v6"
import {
  createHttpSettingsSyncTransport,
  type RecurringSyncTransport,
} from "@/features/sync/http-recurring-transport"
import { openLocalSettingsSyncRuntime } from "@/features/sync/local-recurring-runtime"
import {
  type AccountIdentity,
  createMixedSyncClientWithTransport,
  type MixedClientPorts,
} from "@/features/sync/mixed-sync-client-core"
import { readSettingsSyncQueueSummary } from "@/features/sync/mixed-sync-summary"

const defaultPorts: MixedClientPorts<RecurringSyncTransport> = {
  requireActive: requireActivePlanAccount,
  readSummary: readSettingsSyncQueueSummary,
  openRuntime: openLocalSettingsSyncRuntime,
  sendOperations: dispatchSyncOperationsV6,
  fetchRequest: fetch,
}

// Negotiation selects the transport and action together; durable intentions stay unchanged.
export function createMixedSyncClientV6(
  input: AccountIdentity,
  ports: MixedClientPorts<RecurringSyncTransport> = defaultPorts
) {
  return createMixedSyncClientWithTransport(
    input,
    ports,
    createHttpSettingsSyncTransport
  )
}
