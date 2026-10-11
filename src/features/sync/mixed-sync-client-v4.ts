"use client"

import { requireActivePlanAccount } from "@/features/plans/local-plan-release"
import { dispatchSyncOperationsV4 } from "@/features/sync/client-action-v4"
import { createHttpSyncTransportV4 } from "@/features/sync/http-transport-v4"
import { openLocalPlanSyncRuntime } from "@/features/sync/local-runtime-v2"
import {
  type AccountIdentity,
  createMixedSyncClientWithTransport,
  type MixedClientPorts,
} from "@/features/sync/mixed-sync-client-core"
import { readPlanSyncQueueSummary } from "@/features/sync/mixed-sync-summary"

const defaultPorts: MixedClientPorts = {
  requireActive: requireActivePlanAccount,
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
