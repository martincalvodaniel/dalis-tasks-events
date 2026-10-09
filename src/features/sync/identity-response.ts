import "server-only"

import { syncProtocolHeader } from "@/config/sync-protocol"
import { encodeSyncProtocolRange } from "@/lib/sync/sync-protocol"
import { workspaceIdentitySchema } from "@/schemas/workspace"

export function getSyncIdentityResponse(
  identity: unknown,
  protocolVersion?: number
): Response {
  return Response.json(
    identity === null
      ? { error: "Authentication required" }
      : workspaceIdentitySchema.parse(identity),
    {
      status: identity === null ? 401 : 200,
      headers: {
        "Cache-Control": "private, no-store",
        [syncProtocolHeader]: encodeSyncProtocolRange(protocolVersion),
      },
    }
  )
}
