import { validateRemotePushResultV2 } from "@/lib/sync/remote-push-v2"
import { localSyncResultInputV2Schema } from "@/schemas/local-sync-result-v2"
import { userIdSchema } from "@/schemas/primitives"
import type { LocalSyncResultInputV2 } from "@/types/local-sync-result-v2"

// Correspondence validation cannot confirm a current sender lease or write an ACK.
export function validateLocalSyncResultInputV2(
  input: unknown,
  expectedUserIdInput: unknown
): LocalSyncResultInputV2 {
  const actor = userIdSchema.parse(expectedUserIdInput)
  const submission = localSyncResultInputV2Schema.parse(input)
  validateRemotePushResultV2(
    { transportVersion: 2, status: "complete", results: [submission.result] },
    actor,
    {
      transportVersion: 2,
      expectedUserId: actor,
      operations: [submission.operation],
    }
  )
  return submission
}
