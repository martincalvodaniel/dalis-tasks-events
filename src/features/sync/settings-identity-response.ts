import "server-only"
import {
  settingsSyncProtocolVersion,
  syncProtocolHeader,
} from "@/config/sync-protocol"
import { getSyncIdentityResponse } from "@/features/sync/identity-response"
import { encodeSyncProtocolRange } from "@/lib/sync/sync-protocol"

interface SettingsIdentityPorts {
  readIdentity(): Promise<unknown>
}
const defaultPorts: SettingsIdentityPorts = {
  readIdentity: async () => {
    const { getWorkspaceIdentity } = await import(
      "@/features/workspace/server-identity"
    )
    return getWorkspaceIdentity()
  },
}
export async function getAuthenticatedSettingsSyncIdentityResponse(
  ports: SettingsIdentityPorts = defaultPorts
): Promise<Response> {
  try {
    return getSyncIdentityResponse(
      await ports.readIdentity(),
      settingsSyncProtocolVersion
    )
  } catch {
    return Response.json(
      { error: "Sync identity is temporarily unavailable" },
      {
        status: 503,
        headers: {
          "Cache-Control": "private, no-store",
          [syncProtocolHeader]: encodeSyncProtocolRange(
            settingsSyncProtocolVersion
          ),
        },
      }
    )
  }
}
