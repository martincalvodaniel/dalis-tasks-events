import "server-only"
import {
  type AuthenticatedRecurringPushPorts,
  pushAuthenticatedRecurringSyncBatch,
} from "@/features/sync/authenticated-recurring-push"

const defaultPorts: AuthenticatedRecurringPushPorts = {
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
  execute: async (actor, operation) => {
    const { executeRemoteSettingsOperation } = await import(
      "@/lib/db/remote-recurring-operation-commands"
    )
    return executeRemoteSettingsOperation(actor, operation)
  },
}
// Session, envelope and expected actor checks are shared; only the coherent future defaults differ.
export function pushAuthenticatedSettingsSyncBatch(
  input: unknown,
  headers: Headers,
  ports: AuthenticatedRecurringPushPorts = defaultPorts
) {
  return pushAuthenticatedRecurringSyncBatch(input, headers, ports)
}
