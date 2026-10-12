"use server"
import { headers } from "next/headers"
import { settingsSyncReleaseEnabled } from "@/config/common-plan-release"
import { pushAuthenticatedSettingsSyncBatch } from "@/features/sync/authenticated-settings-push"
import { rejectRetiredSyncPushV5 } from "@/features/sync/retired-sync-push-v5"
export async function pushSyncOperationsV6(input: unknown) {
  const requestHeaders = await headers()
  return settingsSyncReleaseEnabled
    ? pushAuthenticatedSettingsSyncBatch(input, requestHeaders)
    : rejectRetiredSyncPushV5(input, requestHeaders)
}
