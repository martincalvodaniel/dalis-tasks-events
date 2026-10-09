import "server-only"

import {
  type AuthenticatedPushPortsV2,
  pushAuthenticatedSyncBatchV2,
} from "@/features/sync/authenticated-push-v2"
import type { RemotePushResultV2 } from "@/types/remote-push-v2"

export type AuthenticatedPushPortsV3 = AuthenticatedPushPortsV2

const defaultPorts: AuthenticatedPushPortsV3 = {
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
    const { executeRemoteOperationV3 } = await import(
      "@/lib/db/remote-operation-commands-v3"
    )
    return executeRemoteOperationV3(actor, operation)
  },
}

// Prepared generation-three endpoint; session, envelope-two and readiness precede execution.
export function pushAuthenticatedSyncBatchV3(
  input: unknown,
  requestHeaders: Headers,
  ports: AuthenticatedPushPortsV3 = defaultPorts
): Promise<RemotePushResultV2> {
  return pushAuthenticatedSyncBatchV2(input, requestHeaders, ports)
}
