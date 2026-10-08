import { validateRemoteChangesPageV2 } from "@/lib/sync/remote-changes-page-v2"
import { localChangesPageInputV2Schema } from "@/schemas/local-changes-page-v2"
import { userIdSchema } from "@/schemas/primitives"

// Receiving a page neither advances a cursor nor confirms any local intention.
export function validateLocalChangesPageInputV2(
  input: unknown,
  expectedUserIdInput: unknown
) {
  const userId = userIdSchema.parse(expectedUserIdInput)
  const value = localChangesPageInputV2Schema.parse(input)
  const page = validateRemoteChangesPageV2(value.page, userId, value.query)
  const revisions = new Map<string, number>()
  for (const change of page.changes) {
    if (change.kind === "preference") {
      if (
        change.effects.effects.some(
          (effect) => effect.store !== "tags" && effect.store !== "itemViews"
        )
      )
        throw new Error(
          "Local mixed download does not support this personal store"
        )
      continue
    }
    const item = change.item
    if (
      (item.kind !== "task" && item.kind !== "event") ||
      item.recurrence !== null ||
      item.revision < 1
    )
      throw new Error(
        "Local mixed download requires committed simple item records"
      )
    const previous = revisions.get(item.id)
    if (previous !== undefined && item.revision <= previous)
      throw new Error(
        "Local mixed download item revisions must advance within a page"
      )
    revisions.set(item.id, item.revision)
  }
  return { query: value.query, page }
}
