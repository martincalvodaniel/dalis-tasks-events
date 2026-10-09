import "server-only"

import {
  getSyncChangesResponseV2,
  type PullDependenciesV2,
} from "@/features/sync/pull-response-v2"

export interface AuthenticatedPullPortsV2 {
  readSession(headers: Headers): Promise<{ user: { id: string } } | null>
  readReadiness: PullDependenciesV2["readReadiness"]
  readChanges: PullDependenciesV2["readChanges"]
}

const defaultPorts: AuthenticatedPullPortsV2 = {
  readSession: async (requestHeaders) => {
    const { getAuthorizedSessionFromHeaders } = await import(
      "@/lib/auth/session"
    )
    return getAuthorizedSessionFromHeaders(requestHeaders)
  },
  readReadiness: async () => {
    const { readMixedSyncIndexReadiness } = await import(
      "@/lib/db/mixed-sync-index-readiness"
    )
    return readMixedSyncIndexReadiness()
  },
  readChanges: async (actor, query) => {
    const { readRemoteChangesV2 } = await import("@/lib/db/remote-changes-v2")
    return readRemoteChangesV2(actor, query)
  },
}

export async function getAuthenticatedSyncChangesResponseV2(
  request: Request,
  ports: AuthenticatedPullPortsV2 = defaultPorts,
  protocolVersion: 2 | 3 = 2
): Promise<Response> {
  return getSyncChangesResponseV2(
    request,
    {
      readActor: async () =>
        (await ports.readSession(request.headers))?.user.id ?? null,
      readReadiness: () => ports.readReadiness(),
      readChanges: (actor, query) => ports.readChanges(actor, query),
    },
    protocolVersion
  )
}
