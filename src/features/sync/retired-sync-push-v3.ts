import "server-only"

import type { RetiredSyncPushPorts } from "@/features/sync/retired-sync-push"
import { userIdSchema } from "@/schemas/primitives"
import { remotePushProtocolEnvelopeV2Schema } from "@/schemas/remote-push-v2"
import type { RemotePushResultV2 } from "@/types/remote-push-v2"

const defaultPorts: RetiredSyncPushPorts = {
  readSession: async (requestHeaders) => {
    const { getAuthorizedSessionFromHeaders } = await import(
      "@/lib/auth/session"
    )
    return getAuthorizedSessionFromHeaders(requestHeaders)
  },
}

// Preparatory retirement: even a captured generation-three handshake cannot execute or ACK.
// Connect this to the old action only when the complete generation-four product is ready.
export async function rejectRetiredSyncPushV3(
  input: unknown,
  requestHeaders: Headers,
  ports: RetiredSyncPushPorts = defaultPorts
): Promise<RemotePushResultV2> {
  let session: Awaited<ReturnType<RetiredSyncPushPorts["readSession"]>>
  try {
    session = await ports.readSession(requestHeaders)
  } catch {
    throw new Error("Sync authentication is temporarily unavailable")
  }
  const actor = userIdSchema.safeParse(session?.user.id)
  if (!actor.success) return { transportVersion: 2, status: "unauthorized" }
  const envelope = remotePushProtocolEnvelopeV2Schema.safeParse(input)
  if (!envelope.success) return { transportVersion: 2, status: "invalid_batch" }
  if (envelope.data.expectedUserId !== actor.data)
    return { transportVersion: 2, status: "account_changed" }
  return { transportVersion: 2, status: "update_required" }
}
