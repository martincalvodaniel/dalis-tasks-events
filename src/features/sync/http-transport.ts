"use client"

import { syncProtocolHeader } from "@/config/sync-protocol"
import type { SyncCoordinatorPorts } from "@/features/sync/coordinator"
import { SyncTransportError } from "@/features/sync/transport-error"
import { acceptsSyncProtocolRange } from "@/lib/sync/sync-protocol"
import { localChangesPageInputSchema } from "@/schemas/local-sync"
import { userIdSchema } from "@/schemas/primitives"
import {
  remoteChangesPageSchema,
  remotePullQuerySchema,
  remotePushInputSchema,
  remotePushResultSchema,
  remoteSyncErrorSchema,
} from "@/schemas/remote-sync"
import { workspaceIdentitySchema } from "@/schemas/workspace"

export type SyncTransport = Pick<
  SyncCoordinatorPorts,
  "readIdentity" | "pull" | "push"
>

export function createHttpSyncTransport(
  userIdInput: string,
  sendOperations: (input: unknown) => Promise<unknown>,
  fetchRequest: typeof fetch = fetch,
  timeoutMs = 30000
): SyncTransport {
  const userId = userIdSchema.parse(userIdInput)
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000)
    throw new RangeError("Invalid sync transport timeout")
  async function request<Result>(
    path: string,
    handle: (response: Response) => Promise<Result>
  ): Promise<Result> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchRequest(path, {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      })
      return await handle(response)
    } finally {
      clearTimeout(timer)
    }
  }
  async function check(response: Response): Promise<void> {
    if (response.status === 401) throw new SyncTransportError("unauthorized")
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
    if (!acceptsSyncProtocolRange(response.headers.get(syncProtocolHeader)))
      throw new SyncTransportError("update_required")
  }
  async function send(input: unknown): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        Promise.resolve().then(() => sendOperations(input)),
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
    pull: async (cursor) => {
      const query = remotePullQuerySchema.parse({
        after: cursor.after,
        through: cursor.through,
        limit: 50,
      })
      const parameters = new URLSearchParams({
        after: String(query.after),
        limit: String(query.limit),
        expectedUserId: userId,
      })
      if (query.through !== null)
        parameters.set("through", String(query.through))
      return request(`/api/sync/changes?${parameters}`, async (response) => {
        await check(response)
        const page = remoteChangesPageSchema.parse(await response.json())
        if (
          page.changes.length > query.limit ||
          (query.through !== null && page.through !== query.through)
        )
          throw new Error("Pull response exceeds its request bounds")
        return localChangesPageInputSchema.parse({ after: query.after, page })
          .page
      })
    },
    push: async (input) => {
      const parsed = remotePushInputSchema.parse(input)
      if (parsed.expectedUserId !== userId)
        throw new SyncTransportError("account_changed")
      return remotePushResultSchema.parse(await send(parsed))
    },
  }
}
