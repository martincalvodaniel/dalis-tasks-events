import { validateRemoteChangesPageRange } from "@/lib/sync/remote-changes-page-range"
import { remoteChangesPageV2Schema } from "@/schemas/remote-changes-page-v2"
import type { RemoteChangesPageV2 } from "@/types/remote-changes-page-v2"

// Validation neither negotiates transport compatibility nor advances a local cursor.
export function validateRemoteChangesPageV2(
  input: unknown,
  expectedUserIdInput: unknown,
  queryInput: unknown
): RemoteChangesPageV2 {
  const page = remoteChangesPageV2Schema.parse(input)
  validateRemoteChangesPageRange(page, expectedUserIdInput, queryInput)
  return page
}
