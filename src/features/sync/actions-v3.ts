"use server"

import { headers } from "next/headers"
import { commonPlanReleaseEnabled } from "@/config/common-plan-release"
import { pushAuthenticatedSyncBatchV3 } from "@/features/sync/authenticated-push-v3"
import { rejectRetiredSyncPushV3 } from "@/features/sync/retired-sync-push-v3"

export async function pushSyncOperationsV3(input: unknown) {
  const requestHeaders = await headers()
  return commonPlanReleaseEnabled
    ? rejectRetiredSyncPushV3(input, requestHeaders)
    : pushAuthenticatedSyncBatchV3(input, requestHeaders)
}
