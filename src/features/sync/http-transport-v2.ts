"use client"

import type { z } from "zod"
import { syncProtocolHeader } from "@/config/sync-protocol"
import { SyncTransportError } from "@/features/sync/transport-error"
import { validateLocalChangesPageInputV2 } from "@/lib/sync/local-changes-page-v2"
import { validateRemotePushResultV2 } from "@/lib/sync/remote-push-v2"
import { acceptsSyncProtocolRange } from "@/lib/sync/sync-protocol"
import { userIdSchema } from "@/schemas/primitives"
import { remotePushInputV2Schema } from "@/schemas/remote-push-v2"
import {
  remotePullQuerySchema,
  remoteSyncErrorSchema,
} from "@/schemas/remote-sync"
import { workspaceIdentitySchema } from "@/schemas/workspace"
import type { RemoteChangesPageV2 } from "@/types/remote-changes-page-v2"
import type {
  RemotePushInputV2,
  RemotePushResultV2,
} from "@/types/remote-push-v2"

export type SyncPullQueryV2 = z.infer<typeof remotePullQuerySchema>

export interface SyncTransportV2 {
  readIdentity(): Promise<string | null>
  pull(query: SyncPullQueryV2): Promise<RemoteChangesPageV2>
  push(input: RemotePushInputV2): Promise<RemotePushResultV2>
}

// Mixed transport requires an explicit version-two server announcement.
export function createHttpSyncTransportV2(
  userIdInput: string,
  sendOperations: (input: unknown) => Promise<unknown>,
  fetchRequest: typeof fetch = fetch,
  timeoutMs = 30000
): SyncTransportV2 {
  return createHttpSyncTransportForProtocol(
    2,
    userIdInput,
    sendOperations,
    fetchRequest,
    timeoutMs
  )
}

// Negotiation changes independently of the mixed envelopes and durable intentions.
export function createHttpSyncTransportForProtocol(
  protocolVersion: 2 | 3,
  userIdInput: string,
  sendOperations: (input: unknown) => Promise<unknown>,
  fetchRequest: typeof fetch = fetch,
  timeoutMs = 30000
): SyncTransportV2 {
  if (protocolVersion !== 2 && protocolVersion !== 3)
    throw new RangeError("Invalid mixed sync transport protocol")
  const userId = userIdSchema.parse(userIdInput)
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000)
    throw new RangeError("Invalid mixed sync transport timeout")
  async function request<Result>(
    path: string,
    handle: (response: Response) => Promise<Result>
  ): Promise<Result> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await handle(
        await fetchRequest(path, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        })
      )
    } finally {
      clearTimeout(timer)
    }
  }
  async function check(response: Response): Promise<void> {
    if (response.status === 401) throw new SyncTransportError("unauthorized")
    if (response.status === 426) throw new SyncTransportError("update_required")
    if (response.status === 409) {
      const value = remoteSyncErrorSchema.safeParse(
        await response.json().catch(() => null)
      )
      throw new SyncTransportError(
        value.success && value.data.code === "account_changed"
          ? "account_changed"
          : "recovery_required"
      )
    }
    if (!response.ok) throw new SyncTransportError("retry_later")
    if (
      !acceptsSyncProtocolRange(
        response.headers.get(syncProtocolHeader),
        protocolVersion
      )
    )
      throw new SyncTransportError("update_required")
  }
  async function send(input: RemotePushInputV2): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      // A deadline cannot cancel a remote commit; the caller retains the durable intention for replay.
      return await Promise.race([
        Promise.resolve().then(() => sendOperations(structuredClone(input))),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new SyncTransportError("retry_later")),
            timeoutMs
          )
        }),
      ])
    } finally {
      clearTimeout(timer)
    }
  }
  return {
    readIdentity: () =>
      request("/api/sync/identity", async (response) => {
        if (response.status === 401) return null
        await check(response)
        return workspaceIdentitySchema.parse(await response.json()).userId
      }),
    pull: async (queryInput) => {
      const query = remotePullQuerySchema.parse(queryInput)
      const parameters = new URLSearchParams({
        after: String(query.after),
        limit: String(query.limit),
        expectedUserId: userId,
      })
      if (query.through !== null)
        parameters.set("through", String(query.through))
      return request(`/api/sync/changes?${parameters}`, async (response) => {
        await check(response)
        return validateLocalChangesPageInputV2(
          { query, page: await response.json() },
          userId
        ).page
      })
    },
    push: async (input) => {
      const parsed = remotePushInputV2Schema.parse(input)
      if (parsed.expectedUserId !== userId)
        throw new SyncTransportError("account_changed")
      return validateRemotePushResultV2(await send(parsed), userId, parsed)
    },
  }
}
