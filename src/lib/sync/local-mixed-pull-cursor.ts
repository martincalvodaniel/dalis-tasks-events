import { validateLocalChangesPageInputV2 } from "@/lib/sync/local-changes-page-v2"
import { localPullCursorSchema } from "@/schemas/local-sync"

// The caller must persist this decision with every page effect in one transaction.
export function planLocalMixedPullCursor(
  receiptInput: unknown,
  cursorInput: unknown,
  expectedUserId: unknown
) {
  const receipt = validateLocalChangesPageInputV2(receiptInput, expectedUserId)
  const cursor = localPullCursorSchema.parse(cursorInput)
  const { query, page } = receipt
  if (query.after < cursor.after && page.nextAfter <= cursor.after)
    return { status: "ignored" as const, receipt, cursor }
  if (
    query.after !== cursor.after ||
    query.through !== cursor.through ||
    (cursor.through !== null && page.through !== cursor.through)
  )
    throw new Error(
      "Mixed pull cursor or checkpoint changed before application"
    )
  return {
    status: "applied" as const,
    receipt,
    cursor: localPullCursorSchema.parse({
      key: "pull-cursor",
      after: page.nextAfter,
      through: page.hasMore ? page.through : null,
    }),
  }
}
