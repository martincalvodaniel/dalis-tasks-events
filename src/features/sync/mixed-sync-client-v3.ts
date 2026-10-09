"use client"

import { dispatchSyncOperationsV3 } from "@/features/sync/client-action-v3"
import { createHttpSyncTransportV3 } from "@/features/sync/http-transport-v3"
import { openLocalSyncRuntimeV2 } from "@/features/sync/local-runtime-v2"
import {
  type AccountIdentity,
  createMixedSyncClientWithTransport,
  type MixedClientPorts,
} from "@/features/sync/mixed-sync-client-core"
import { readMixedSyncQueueSummary } from "@/features/sync/mixed-sync-summary"
import { requireActiveAccount } from "@/features/workspace/require-active-account"

const defaultPorts: MixedClientPorts = {
  requireActive: requireActiveAccount,
  readSummary: readMixedSyncQueueSummary,
  openRuntime: openLocalSyncRuntimeV2,
  sendOperations: dispatchSyncOperationsV3,
  fetchRequest: fetch,
}

// Negotiation selects the transport and action together; durable intentions stay unchanged.
export function createMixedSyncClientV3(
  input: AccountIdentity,
  ports: MixedClientPorts = defaultPorts
) {
  return createMixedSyncClientWithTransport(
    input,
    ports,
    createHttpSyncTransportV3
  )
}
