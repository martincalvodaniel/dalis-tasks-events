import "server-only"

import type { z } from "zod"
import { syncProtocolHeader } from "@/config/sync-protocol"
import { RemoteCursorAheadError } from "@/lib/db/remote-changes"
import { validateLocalChangesPageInputV2 } from "@/lib/sync/local-changes-page-v2"
import { encodeSyncProtocolRange } from "@/lib/sync/sync-protocol"
import { mixedPullRequestSchema } from "@/schemas/mixed-pull-request"
import { userIdSchema } from "@/schemas/primitives"
import type { remotePullQuerySchema } from "@/schemas/remote-sync"
import type { RemoteChangesPageV2 } from "@/types/remote-changes-page-v2"

export interface PullDependenciesV2 {
  readActor(): Promise<string | null>
  readReadiness(): Promise<{
    ready: boolean
    missing: string[]
    incompatible: string[]
  }>
  readChanges(
    actor: string,
    query: z.infer<typeof remotePullQuerySchema>
  ): Promise<RemoteChangesPageV2>
}

export async function getSyncChangesResponseV2(
  request: Request,
  dependencies: PullDependenciesV2
): Promise<Response> {
  const respond = (body: unknown, status: number) =>
    Response.json(body, {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        [syncProtocolHeader]: encodeSyncProtocolRange(2),
      },
    })
  const unavailable = () =>
    respond({ error: "Sync download is temporarily unavailable" }, 503)
  try {
    const actor = userIdSchema.safeParse(await dependencies.readActor())
    if (!actor.success)
      return respond({ error: "Authentication required" }, 401)
    const entries = [...new URL(request.url).searchParams.entries()]
    if (new Set(entries.map(([key]) => key)).size !== entries.length)
      return respond({ error: "Invalid pull query" }, 400)
    const input = mixedPullRequestSchema.safeParse(Object.fromEntries(entries))
    if (!input.success) return respond({ error: "Invalid pull query" }, 400)
    const { expectedUserId, ...query } = input.data
    if (expectedUserId !== actor.data)
      return respond(
        { error: "Authenticated account changed", code: "account_changed" },
        409
      )
    const readiness = await dependencies.readReadiness()
    if (
      readiness.ready !== true ||
      !Array.isArray(readiness.missing) ||
      !Array.isArray(readiness.incompatible) ||
      readiness.missing.length ||
      readiness.incompatible.length
    )
      return unavailable()
    let page: RemoteChangesPageV2
    try {
      page = await dependencies.readChanges(actor.data, structuredClone(query))
    } catch (error) {
      if (error instanceof RemoteCursorAheadError)
        return respond(
          {
            error: "Pull cursor exceeds the committed journal",
            code: "cursor_ahead",
          },
          409
        )
      throw error
    }
    const validated = validateLocalChangesPageInputV2(
      { query, page },
      actor.data
    )
    return respond(validated.page, 200)
  } catch {
    return unavailable()
  }
}
