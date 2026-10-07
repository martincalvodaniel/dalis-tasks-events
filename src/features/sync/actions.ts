"use server"

import { headers } from "next/headers"
import { pushSyncBatch } from "@/features/sync/push-batch"
import { getAuthorizedSessionFromHeaders } from "@/lib/auth/session"
import { executeRemoteItemOperation } from "@/lib/db/remote-item-commands"

export async function pushSyncOperations(input: unknown) {
  return pushSyncBatch(input, {
    readActor: async () =>
      (await getAuthorizedSessionFromHeaders(await headers()))?.user.id ?? null,
    execute: executeRemoteItemOperation,
  })
}
