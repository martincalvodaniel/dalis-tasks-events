"use server"

import { headers } from "next/headers"
import { rejectRetiredSyncPushV2 } from "@/features/sync/retired-sync-push-v2"

export async function pushSyncOperationsV2(input: unknown) {
  return rejectRetiredSyncPushV2(input, await headers())
}
