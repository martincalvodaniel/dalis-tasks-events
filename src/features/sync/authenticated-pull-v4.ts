import "server-only"

import {
  type AuthenticatedPullPortsV2,
  getAuthenticatedSyncChangesResponseV2,
} from "@/features/sync/authenticated-pull-v2"

const defaultPorts: AuthenticatedPullPortsV2 = {
  readSession: async (headers) => {
    const { getAuthorizedSessionFromHeaders } = await import(
      "@/lib/auth/session"
    )
    return getAuthorizedSessionFromHeaders(headers)
  },
  readReadiness: async () => {
    const { readPlacementSyncIndexReadiness } = await import(
      "@/lib/db/mixed-sync-index-readiness"
    )
    return readPlacementSyncIndexReadiness()
  },
  readChanges: async (actor, query) => {
    const { readRemoteChangesV2 } = await import("@/lib/db/remote-changes-v2")
    return readRemoteChangesV2(actor, query)
  },
}

export function getAuthenticatedSyncChangesResponseV4(
  request: Request,
  ports: AuthenticatedPullPortsV2 = defaultPorts
): Promise<Response> {
  return getAuthenticatedSyncChangesResponseV2(request, ports, 4)
}
