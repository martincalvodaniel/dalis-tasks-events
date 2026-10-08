import { userIdSchema } from "@/schemas/primitives"
import { remoteChangeV2Schema } from "@/schemas/remote-change-v2"
import { remoteItemChangeSchema } from "@/schemas/remote-sync"
import type { RemoteChangeV2 } from "@/types/remote-change-v2"

export function validateRemoteChangeV2(
  input: unknown,
  expectedUserIdInput: unknown
): RemoteChangeV2 {
  const expectedUserId = userIdSchema.parse(expectedUserIdInput)
  const change = remoteChangeV2Schema.parse(input)
  if (change.recipientUserId !== expectedUserId)
    throw new Error("Remote journal entry belongs to another account")
  return change
}

// Adapt a complete entry without filtering it or advancing a local checkpoint.
export function decodeRemoteChange(
  input: unknown,
  expectedUserIdInput: unknown
): RemoteChangeV2 {
  const versioned = remoteChangeV2Schema.safeParse(input)
  if (versioned.success)
    return validateRemoteChangeV2(versioned.data, expectedUserIdInput)
  const legacy = remoteItemChangeSchema.parse(input)
  return validateRemoteChangeV2(
    { ...legacy, version: 2, kind: "item" },
    expectedUserIdInput
  )
}
