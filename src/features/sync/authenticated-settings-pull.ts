import "server-only"
import type { AuthenticatedRecurringPullPorts } from "@/features/sync/authenticated-recurring-pull"
import { getSettingsSyncChangesResponse } from "@/features/sync/pull-recurring-response"

const defaultPorts: AuthenticatedRecurringPullPorts = {
  readSession: async (headers) => {
    const { getAuthorizedSessionFromHeaders } = await import(
      "@/lib/auth/session"
    )
    return getAuthorizedSessionFromHeaders(headers)
  },
  readReadiness: async () => {
    const { readSettingsSyncIndexReadiness } = await import(
      "@/lib/db/mixed-sync-index-readiness"
    )
    return readSettingsSyncIndexReadiness()
  },
  readChanges: async (actor, query) => {
    const { readRemoteSettingsChangesV2 } = await import(
      "@/lib/db/remote-changes-v2"
    )
    return readRemoteSettingsChangesV2(actor, query)
  },
}
export function getAuthenticatedSettingsSyncChangesResponse(
  request: Request,
  ports: AuthenticatedRecurringPullPorts = defaultPorts
): Promise<Response> {
  return getSettingsSyncChangesResponse(request, {
    readActor: async () =>
      (await ports.readSession(request.headers))?.user.id ?? null,
    readReadiness: () => ports.readReadiness(),
    readChanges: (actor, query) => ports.readChanges(actor, query),
  })
}
