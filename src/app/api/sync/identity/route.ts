import { activeProductSyncProtocol } from "@/config/common-plan-release"
import { getSyncIdentityResponse } from "@/features/sync/identity-response"
import { getAuthenticatedSettingsSyncIdentityResponse } from "@/features/sync/settings-identity-response"
import { getWorkspaceIdentity } from "@/features/workspace/server-identity"

export async function GET() {
  if (activeProductSyncProtocol === 6)
    return getAuthenticatedSettingsSyncIdentityResponse()
  return getSyncIdentityResponse(
    await getWorkspaceIdentity(),
    activeProductSyncProtocol
  )
}
