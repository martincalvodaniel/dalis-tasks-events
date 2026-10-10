import { getAuthenticatedSyncChangesResponseV3 } from "@/features/sync/authenticated-pull-v3"

export async function GET(request: Request) {
  return getAuthenticatedSyncChangesResponseV3(request)
}
