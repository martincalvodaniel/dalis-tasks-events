import "server-only"

import { userIdSchema } from "@/schemas/primitives"
import { remotePushProtocolEnvelopeSchema } from "@/schemas/remote-sync"
import type { RemotePushResult } from "@/types/remote-sync"

export interface RetiredSyncPushPorts {
  readSession(headers: Headers): Promise<{ user: { id: string } } | null>
}

const defaultPorts: RetiredSyncPushPorts = {
  readSession: async (requestHeaders) => {
    const { getAuthorizedSessionFromHeaders } = await import(
      "@/lib/auth/session"
    )
    return getAuthorizedSessionFromHeaders(requestHeaders)
  },
}

// Preparatory retirement response: it never executes or confirms an operation.
export async function rejectRetiredSyncPush(
  input: unknown,
  requestHeaders: Headers,
  ports: RetiredSyncPushPorts = defaultPorts
): Promise<RemotePushResult> {
  let session: Awaited<ReturnType<RetiredSyncPushPorts["readSession"]>>
  try {
    session = await ports.readSession(requestHeaders)
  } catch {
    throw new Error("Sync authentication is temporarily unavailable")
  }
  const actor = userIdSchema.safeParse(session?.user.id)
  if (!actor.success) return { status: "unauthorized" }
  const envelope = remotePushProtocolEnvelopeSchema.safeParse(input)
  if (!envelope.success) return { status: "invalid_batch" }
  if (envelope.data.expectedUserId !== actor.data)
    return { status: "account_changed" }
  return { status: "update_required" }
}
