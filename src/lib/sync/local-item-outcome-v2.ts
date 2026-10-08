import { validateRemotePushResultV2 } from "@/lib/sync/remote-push-v2"
import { localItemOutcomeV2Schema } from "@/schemas/local-item-outcome-v2"
import { localOperationOutcomeSchema } from "@/schemas/local-sync"
import { userIdSchema } from "@/schemas/primitives"
import type { LocalItemOutcomeV2 } from "@/types/local-item-outcome-v2"

export function validateLocalItemOutcomeV2(
  input: unknown,
  expectedUserIdInput: unknown
): LocalItemOutcomeV2 {
  const actor = userIdSchema.parse(expectedUserIdInput)
  const value = localItemOutcomeV2Schema.parse(input)
  validateRemotePushResultV2(
    { transportVersion: 2, status: "complete", results: [value.result] },
    actor,
    {
      transportVersion: 2,
      expectedUserId: actor,
      operations: [value.operation],
    }
  )
  const command = value.operation.command
  if (!("itemId" in command))
    throw new Error("Item outcome requires an item identity")
  for (const record of [value.local, value.base]) {
    if (record && (record.ownerId !== actor || record.id !== command.itemId))
      throw new Error(
        "Item outcome snapshot belongs to another account or item"
      )
  }
  // A shadow observed at receipt time need not be an ancestor of the submitted intention.
  return value
}

// Normalize only in memory; decoding evidence never writes an ACK or grants access.
export function decodeLocalItemOutcome(
  input: unknown,
  expectedUserIdInput: unknown
): LocalItemOutcomeV2 {
  const versioned = localItemOutcomeV2Schema.safeParse(input)
  if (versioned.success)
    return validateLocalItemOutcomeV2(versioned.data, expectedUserIdInput)
  const legacy = localOperationOutcomeSchema.parse(input)
  return validateLocalItemOutcomeV2(
    {
      ...legacy,
      version: 2,
      kind: "item",
      result: { kind: "item", outcome: legacy.result },
    },
    expectedUserIdInput
  )
}
