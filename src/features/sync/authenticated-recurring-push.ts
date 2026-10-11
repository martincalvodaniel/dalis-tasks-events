import "server-only"

import {
  pushRecurringSyncBatch,
  type RecurringPushDependencies,
} from "@/features/sync/push-recurring-batch"
import type { MixedSyncIndexReadiness } from "@/lib/db/mixed-sync-index-readiness"
import type { RemoteRecurringPushResult } from "@/types/remote-recurring-push"

export interface AuthenticatedRecurringPushPorts {
  readSession(headers: Headers): Promise<{ user: { id: string } } | null>
  readReadiness(): Promise<MixedSyncIndexReadiness>
  execute: RecurringPushDependencies["execute"]
}
const defaultPorts: AuthenticatedRecurringPushPorts = {
  readSession: async (headers) => {
    const { getAuthorizedSessionFromHeaders } = await import(
      "@/lib/auth/session"
    )
    return getAuthorizedSessionFromHeaders(headers)
  },
  readReadiness: async () => {
    const { readRecurringSyncIndexReadiness } = await import(
      "@/lib/db/mixed-sync-index-readiness"
    )
    return readRecurringSyncIndexReadiness()
  },
  execute: async (actor, operation) => {
    const { executeRemoteRecurringOperation } = await import(
      "@/lib/db/remote-recurring-operation-commands"
    )
    return executeRemoteRecurringOperation(actor, operation)
  },
}

// No public action yet. Session and strict batch checks precede the readonly index inspection.
export function pushAuthenticatedRecurringSyncBatch(
  input: unknown,
  headers: Headers,
  ports: AuthenticatedRecurringPushPorts = defaultPorts
): Promise<RemoteRecurringPushResult> {
  let ready = false
  return pushRecurringSyncBatch(input, {
    readActor: async () => {
      try {
        return (await ports.readSession(headers))?.user.id ?? null
      } catch {
        throw new Error("Sync authentication is temporarily unavailable")
      }
    },
    execute: async (actor, operation) => {
      if (!ready) {
        try {
          const state = await ports.readReadiness()
          if (
            state.ready !== true ||
            !Array.isArray(state.missing) ||
            !Array.isArray(state.incompatible) ||
            state.missing.length ||
            state.incompatible.length
          )
            throw new Error("Recurring sync storage is not ready")
        } catch {
          throw new Error("Sync storage is temporarily unavailable")
        }
        ready = true
      }
      return ports.execute(actor, operation)
    },
  })
}
