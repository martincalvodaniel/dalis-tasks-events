"use server"

import { headers } from "next/headers"
import { pushAuthenticatedSyncBatchV4 } from "@/features/sync/authenticated-push-v4"

export async function pushSyncOperationsV4(input: unknown) {
  return pushAuthenticatedSyncBatchV4(input, await headers())
}
