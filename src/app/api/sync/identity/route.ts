import { activeProductSyncProtocol } from "@/config/common-plan-release"
import { getSyncIdentityResponse } from "@/features/sync/identity-response"
import { getWorkspaceIdentity } from "@/features/workspace/server-identity"

export async function GET() {
  return getSyncIdentityResponse(
    await getWorkspaceIdentity(),
    activeProductSyncProtocol
  )
}
