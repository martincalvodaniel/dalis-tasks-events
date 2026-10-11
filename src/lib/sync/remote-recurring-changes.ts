import { decodeRemoteChange } from "@/lib/sync/remote-change-v2"
import { validateRemoteChangesPageRange } from "@/lib/sync/remote-changes-page-range"
import { userIdSchema } from "@/schemas/primitives"
import { remotePlanOccurrenceChangeSchema } from "@/schemas/remote-plan-occurrence-result"
import { remoteRecurringChangesPageSchema } from "@/schemas/remote-recurring-changes"
import type {
  RemoteRecurringChange,
  RemoteRecurringChangesPage,
} from "@/types/remote-recurring-sync"

// No filtering, rewriting or cursor changes; active decoders stay strict.
export function decodeRemoteRecurringChange(
  input: unknown,
  expectedUserIdInput: unknown
): RemoteRecurringChange {
  const actor = userIdSchema.parse(expectedUserIdInput)
  const appearance = remotePlanOccurrenceChangeSchema.safeParse(input)
  if (!appearance.success) return decodeRemoteChange(input, actor)
  if (appearance.data.recipientUserId !== actor)
    throw new Error("Remote appearance journal belongs to another account")
  return appearance.data
}
export function validateRemoteRecurringChangesPage(
  input: unknown,
  expectedUserIdInput: unknown,
  queryInput: unknown
): RemoteRecurringChangesPage {
  const page = remoteRecurringChangesPageSchema.parse(input)
  validateRemoteChangesPageRange(page, expectedUserIdInput, queryInput)
  return page
}
