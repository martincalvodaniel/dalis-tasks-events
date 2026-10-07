import "server-only"

import { RemoteCursorAheadError } from "@/lib/db/remote-changes"
import { remotePullQuerySchema } from "@/schemas/remote-sync"
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
      headers: { "Cache-Control": "private, no-store" },
    })
  const actor = await dependencies.readActor()
  if (!actor) return respond({ error: "Authentication required" }, 401)
  const entries = [...new URL(request.url).searchParams.entries()]
  if (new Set(entries.map(([key]) => key)).size !== entries.length)
    return respond({ error: "Invalid pull query" }, 400)
  const query = remotePullQuerySchema.safeParse(Object.fromEntries(entries))
  if (!query.success) return respond({ error: "Invalid pull query" }, 400)
  try {
    return respond(await dependencies.readChanges(actor, query.data), 200)
  } catch (error) {
    if (error instanceof RemoteCursorAheadError)
      return respond(
        { error: "Pull cursor exceeds the committed journal" },
        409
      )
    return respond({ error: "Sync download is temporarily unavailable" }, 503)
  }
}
