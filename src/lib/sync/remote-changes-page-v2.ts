import { userIdSchema } from "@/schemas/primitives"
import { remoteChangesPageV2Schema } from "@/schemas/remote-changes-page-v2"
import { remotePullQuerySchema } from "@/schemas/remote-sync"
import type { RemoteChangesPageV2 } from "@/types/remote-changes-page-v2"

// Validation neither negotiates transport compatibility nor advances a local cursor.
export function validateRemoteChangesPageV2(
  input: unknown,
  expectedUserIdInput: unknown,
  queryInput: unknown
): RemoteChangesPageV2 {
  const userId = userIdSchema.parse(expectedUserIdInput)
  const query = remotePullQuerySchema.parse(queryInput)
  const page = remoteChangesPageV2Schema.parse(input)
  if (page.changes.some((change) => change.recipientUserId !== userId))
    throw new Error("Mixed change page belongs to another account")
  if (query.through !== null && page.through !== query.through)
    throw new Error("Mixed change page changed its frozen checkpoint")
  if (
    page.through < query.after ||
    page.changes.length > query.limit ||
    page.nextAfter !== query.after + page.changes.length ||
    page.changes.some(
      (change, index) => change.sequence !== query.after + index + 1
    ) ||
    (!page.changes.length && page.through !== query.after)
  )
    throw new Error("Mixed change page does not match its requested range")
  return page
}
