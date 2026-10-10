import "server-only"

import {
  type AuthenticatedPushPortsV2,
  pushAuthenticatedSyncBatchV2,
} from "@/features/sync/authenticated-push-v2"
import type { RemotePushResultV2 } from "@/types/remote-push-v2"

export type AuthenticatedPushPortsV4 = AuthenticatedPushPortsV2

const defaultPorts: AuthenticatedPushPortsV4 = {
  readSession: async (requestHeaders) => {
    const { getAuthorizedSessionFromHeaders } = await import(
      "@/lib/auth/session"
    )
    return getAuthorizedSessionFromHeaders(requestHeaders)
  },
  readReadiness: async () => {
    const { readPlacementSyncIndexReadiness } = await import(
      "@/lib/db/mixed-sync-index-readiness"
    )
    return readPlacementSyncIndexReadiness()
  },
  execute: async (actor, operation) => {
    const { executeRemoteOperationV4 } = await import(
      "@/lib/db/remote-operation-commands-v4"
    )
    return executeRemoteOperationV4(actor, operation)
  },
}

// Prepared generation-four endpoint; session, envelope-two and readiness precede execution.
export function pushAuthenticatedSyncBatchV4(
  input: unknown,
  requestHeaders: Headers,
  ports: AuthenticatedPushPortsV4 = defaultPorts
): Promise<RemotePushResultV2> {
  return pushAuthenticatedSyncBatchV2(input, requestHeaders, ports)
}
