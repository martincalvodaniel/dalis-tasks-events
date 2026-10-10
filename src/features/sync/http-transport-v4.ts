"use client"

import { planSyncProtocolVersion } from "@/config/sync-protocol"
import {
  createHttpSyncTransportForProtocol,
  type SyncTransportV2,
} from "@/features/sync/http-transport-v2"

// Prepared transport only; product callers must switch together with the server.
export function createHttpSyncTransportV4(
  userIdInput: string,
  sendOperations: (input: unknown) => Promise<unknown>,
  fetchRequest: typeof fetch = fetch,
  timeoutMs = 30000
): SyncTransportV2 {
  return createHttpSyncTransportForProtocol(
    planSyncProtocolVersion,
    userIdInput,
    sendOperations,
    fetchRequest,
    timeoutMs
  )
}
