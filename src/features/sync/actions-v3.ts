"use server"

import { headers } from "next/headers"
import { pushAuthenticatedSyncBatchV3 } from "@/features/sync/authenticated-push-v3"

export async function pushSyncOperationsV3(input: unknown) {
  return pushAuthenticatedSyncBatchV3(input, await headers())
}
