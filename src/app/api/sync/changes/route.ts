import { getSyncChangesResponse } from "@/features/sync/pull-response"
import { getAuthorizedSessionFromHeaders } from "@/lib/auth/session"
import { readRemoteChanges } from "@/lib/db/remote-changes"

export async function GET(request: Request) {
  return getSyncChangesResponse(request, {
    readActor: async () =>
      (await getAuthorizedSessionFromHeaders(request.headers))?.user.id ?? null,
    readChanges: readRemoteChanges,
  })
}
