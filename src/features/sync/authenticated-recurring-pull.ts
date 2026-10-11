import "server-only"

import {
  getRecurringSyncChangesResponse,
  type RecurringPullDependencies,
} from "@/features/sync/pull-recurring-response"

export interface AuthenticatedRecurringPullPorts {
  readSession(headers: Headers): Promise<{ user: { id: string } } | null>
  readReadiness: RecurringPullDependencies["readReadiness"]
  readChanges: RecurringPullDependencies["readChanges"]
}

const defaultPorts: AuthenticatedRecurringPullPorts = {
  readSession: async (requestHeaders) => {
    const { getAuthorizedSessionFromHeaders } = await import(
      "@/lib/auth/session"
    )
    return getAuthorizedSessionFromHeaders(requestHeaders)
  },
  readReadiness: async () => {
    const { readRecurringSyncIndexReadiness } = await import(
      "@/lib/db/mixed-sync-index-readiness"
    )
    return readRecurringSyncIndexReadiness()
  },
  readChanges: async (actor, query) => {
    const { readRemoteRecurringChangesV2 } = await import(
      "@/lib/db/remote-changes-v2"
    )
    return readRemoteRecurringChangesV2(actor, query)
  },
}

export async function getAuthenticatedRecurringSyncChangesResponse(
  request: Request,
  ports: AuthenticatedRecurringPullPorts = defaultPorts
): Promise<Response> {
  return getRecurringSyncChangesResponse(request, {
    readActor: async () =>
      (await ports.readSession(request.headers))?.user.id ?? null,
    readReadiness: () => ports.readReadiness(),
    readChanges: (actor, query) => ports.readChanges(actor, query),
  })
}
