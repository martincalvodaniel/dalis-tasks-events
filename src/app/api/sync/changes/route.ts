import { commonPlanReleaseEnabled } from "@/config/common-plan-release"
import { getAuthenticatedSyncChangesResponseV3 } from "@/features/sync/authenticated-pull-v3"
import { getAuthenticatedSyncChangesResponseV4 } from "@/features/sync/authenticated-pull-v4"

export async function GET(request: Request) {
  return commonPlanReleaseEnabled
    ? getAuthenticatedSyncChangesResponseV4(request)
    : getAuthenticatedSyncChangesResponseV3(request)
}
