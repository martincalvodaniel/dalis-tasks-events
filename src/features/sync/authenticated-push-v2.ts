import "server-only"

import {
  type GuardedPushDependenciesV2,
  pushGuardedSyncBatchV2,
} from "@/features/sync/guarded-push-batch-v2"
import type { RemotePushResultV2 } from "@/types/remote-push-v2"

export interface AuthenticatedPushPortsV2 {
  readSession(headers: Headers): Promise<{ user: { id: string } } | null>
  readReadiness: GuardedPushDependenciesV2["readReadiness"]
  execute: GuardedPushDependenciesV2["execute"]
}

const defaultPorts: AuthenticatedPushPortsV2 = {
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
  execute: async (actor, operation) => {
    const { executeRemoteOperationV2 } = await import(
      "@/lib/db/remote-operation-commands"
    )
    return executeRemoteOperationV2(actor, operation)
  },
}

export async function pushAuthenticatedSyncBatchV2(
  input: unknown,
  requestHeaders: Headers,
  ports: AuthenticatedPushPortsV2 = defaultPorts
): Promise<RemotePushResultV2> {
  return pushGuardedSyncBatchV2(input, {
    readActor: async () =>
      (await ports.readSession(requestHeaders))?.user.id ?? null,
    readReadiness: () => ports.readReadiness(),
    execute: (actor, operation) => ports.execute(actor, operation),
  })
}
