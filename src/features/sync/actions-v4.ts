"use server"

import { headers } from "next/headers"
import { recurringSyncReleaseEnabled } from "@/config/common-plan-release"
import { pushAuthenticatedSyncBatchV4 } from "@/features/sync/authenticated-push-v4"
import { rejectRetiredSyncPushV4 } from "@/features/sync/retired-sync-push-v4"

export async function pushSyncOperationsV4(input: unknown) {
  const requestHeaders = await headers()
  return recurringSyncReleaseEnabled
    ? rejectRetiredSyncPushV4(input, requestHeaders)
    : pushAuthenticatedSyncBatchV4(input, requestHeaders)
}
