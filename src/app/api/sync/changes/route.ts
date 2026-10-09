import { getAuthenticatedSyncChangesResponseV2 } from "@/features/sync/authenticated-pull-v2"

export async function GET(request: Request) {
  return getAuthenticatedSyncChangesResponseV2(request)
}
