"use client"

import { dispatchSyncOperationsV4 } from "@/features/sync/client-action-v4"
import { createHttpSyncTransportV4 } from "@/features/sync/http-transport-v4"
import { openLocalPlanSyncRuntime } from "@/features/sync/local-runtime-v2"
import {
  type AccountIdentity,
  createMixedSyncClientWithTransport,
  type MixedClientPorts,
} from "@/features/sync/mixed-sync-client-core"
import { readPlanSyncQueueSummary } from "@/features/sync/mixed-sync-summary"
import { requireActiveAccount } from "@/features/workspace/require-active-account"

const defaultPorts: MixedClientPorts = {
  requireActive: requireActiveAccount,
  readSummary: readPlanSyncQueueSummary,
  openRuntime: openLocalPlanSyncRuntime,
  sendOperations: dispatchSyncOperationsV4,
  fetchRequest: fetch,
}

// Negotiation selects the transport and action together; durable intentions stay unchanged.
export function createMixedSyncClientV4(
  input: AccountIdentity,
  ports: MixedClientPorts = defaultPorts
) {
  return createMixedSyncClientWithTransport(
    input,
    ports,
    createHttpSyncTransportV4
  )
}
