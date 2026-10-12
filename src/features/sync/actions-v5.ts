"use server"

import { headers } from "next/headers"
import {
  activeProductSyncProtocol,
  recurringSyncReleaseEnabled,
} from "@/config/common-plan-release"
import { pushAuthenticatedRecurringSyncBatch } from "@/features/sync/authenticated-recurring-push"
import { rejectRetiredSyncPushV4 } from "@/features/sync/retired-sync-push-v4"
import { rejectRetiredSyncPushV5 } from "@/features/sync/retired-sync-push-v5"

export async function pushSyncOperationsV5(input: unknown) {
  const requestHeaders = await headers()
  if (activeProductSyncProtocol === 6)
    return rejectRetiredSyncPushV5(input, requestHeaders)
  // The unchanged envelope-two guard also rejects a compiled but inactive future reference.
  return recurringSyncReleaseEnabled
    ? pushAuthenticatedRecurringSyncBatch(input, requestHeaders)
    : rejectRetiredSyncPushV4(input, requestHeaders)
}
