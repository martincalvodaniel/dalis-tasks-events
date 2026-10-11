import { userIdSchema } from "@/schemas/primitives"
import { remotePullQuerySchema } from "@/schemas/remote-sync"

// Schemas validate the envelope first. Scope-specific readers share only range checks.
export function validateRemoteChangesPageRange(
  page: {
    changes: readonly { recipientUserId: string; sequence: number }[]
    through: number
    nextAfter: number
  },
  expectedUserIdInput: unknown,
  queryInput: unknown
): void {
  const userId = userIdSchema.parse(expectedUserIdInput)
  const query = remotePullQuerySchema.parse(queryInput)
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
}
