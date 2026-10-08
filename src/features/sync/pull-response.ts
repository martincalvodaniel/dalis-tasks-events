import "server-only"

import { syncProtocolHeader } from "@/config/sync-protocol"
import { RemoteCursorAheadError } from "@/lib/db/remote-changes"
import { encodeSyncProtocolRange } from "@/lib/sync/sync-protocol"
import { remotePullRequestSchema } from "@/schemas/remote-sync"
import type { RemoteChangesPage } from "@/types/remote-sync"

interface PullDependencies {
  readActor(): Promise<string | null>
  readChanges(actor: string, query: unknown): Promise<RemoteChangesPage>
}

export async function getSyncChangesResponse(
  request: Request,
  dependencies: PullDependencies
): Promise<Response> {
  const respond = (body: unknown, status: number) =>
    Response.json(body, {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        [syncProtocolHeader]: encodeSyncProtocolRange(),
      },
    })
  const actor = await dependencies.readActor()
  if (!actor) return respond({ error: "Authentication required" }, 401)
  const entries = [...new URL(request.url).searchParams.entries()]
  if (new Set(entries.map(([key]) => key)).size !== entries.length)
    return respond({ error: "Invalid pull query" }, 400)
  const query = remotePullRequestSchema.safeParse(Object.fromEntries(entries))
  if (!query.success) return respond({ error: "Invalid pull query" }, 400)
  const { expectedUserId, ...parameters } = query.data
  if (expectedUserId !== undefined && expectedUserId !== actor)
    return respond(
      { error: "Authenticated account changed", code: "account_changed" },
      409
    )
  try {
    return respond(await dependencies.readChanges(actor, parameters), 200)
  } catch (error) {
    if (error instanceof RemoteCursorAheadError)
      return respond(
        {
          error: "Pull cursor exceeds the committed journal",
          code: "cursor_ahead",
        },
        409
      )
    return respond({ error: "Sync download is temporarily unavailable" }, 503)
  }
}
