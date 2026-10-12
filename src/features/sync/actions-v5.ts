"use server"

import { headers } from "next/headers"
import { recurringSyncReleaseEnabled } from "@/config/common-plan-release"
import { pushAuthenticatedRecurringSyncBatch } from "@/features/sync/authenticated-recurring-push"
import { rejectRetiredSyncPushV4 } from "@/features/sync/retired-sync-push-v4"

export async function pushSyncOperationsV5(input: unknown) {
  const requestHeaders = await headers()
  // The unchanged envelope-two guard also rejects a compiled but inactive future reference.
  return recurringSyncReleaseEnabled
    ? pushAuthenticatedRecurringSyncBatch(input, requestHeaders)
    : rejectRetiredSyncPushV4(input, requestHeaders)
}
