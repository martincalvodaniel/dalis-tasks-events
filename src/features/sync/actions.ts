"use server"

import { headers } from "next/headers"
import { rejectRetiredSyncPush } from "@/features/sync/retired-sync-push"

export async function pushSyncOperations(input: unknown) {
  return rejectRetiredSyncPush(input, await headers())
}
