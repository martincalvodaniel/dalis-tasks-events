import {
  activeProductSyncProtocol,
  commonPlanReleaseEnabled,
  recurringSyncReleaseEnabled,
} from "@/config/common-plan-release"
import { getAuthenticatedSyncChangesResponseV3 } from "@/features/sync/authenticated-pull-v3"
import { getAuthenticatedSyncChangesResponseV4 } from "@/features/sync/authenticated-pull-v4"
import { getAuthenticatedRecurringSyncChangesResponse } from "@/features/sync/authenticated-recurring-pull"
import { getAuthenticatedSettingsSyncChangesResponse } from "@/features/sync/authenticated-settings-pull"

export async function GET(request: Request) {
  if (activeProductSyncProtocol === 6)
    return getAuthenticatedSettingsSyncChangesResponse(request)
  if (recurringSyncReleaseEnabled)
    return getAuthenticatedRecurringSyncChangesResponse(request)
  return commonPlanReleaseEnabled
    ? getAuthenticatedSyncChangesResponseV4(request)
    : getAuthenticatedSyncChangesResponseV3(request)
}
