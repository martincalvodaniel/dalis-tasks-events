"use server"

import { headers } from "next/headers"
import { pushAuthenticatedRecurringSyncBatch } from "@/features/sync/authenticated-recurring-push"

export async function pushSyncOperationsV5(input: unknown) {
  return pushAuthenticatedRecurringSyncBatch(input, await headers())
}
