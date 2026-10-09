"use server"

import { headers } from "next/headers"
import { pushAuthenticatedSyncBatchV2 } from "@/features/sync/authenticated-push-v2"

export async function pushSyncOperationsV2(input: unknown) {
  return pushAuthenticatedSyncBatchV2(input, await headers())
}
