import { remoteShadowSchema } from "@/schemas/local-sync"
import { userIdSchema } from "@/schemas/primitives"
import { remoteShadowV2Schema } from "@/schemas/remote-shadow-v2"
import type { RemoteShadowV2 } from "@/types/remote-shadow-v2"

// Parsing observed evidence cannot establish a commit, access, ACK, or operation ancestor.
export function validateRemoteShadowV2(
  input: unknown,
  expectedUserIdInput: unknown
): RemoteShadowV2 {
  const actor = userIdSchema.parse(expectedUserIdInput)
  const shadow = remoteShadowV2Schema.parse(input)
  const owner =
    shadow.kind === "item" ? shadow.record.ownerId : shadow.record.record.userId
  if (owner !== actor)
    throw new Error("Remote shadow belongs to another account")
  return shadow
}

export function decodeRemoteShadow(
  input: unknown,
  expectedUserIdInput: unknown
): RemoteShadowV2 {
  const versioned = remoteShadowV2Schema.safeParse(input)
  if (versioned.success)
    return validateRemoteShadowV2(versioned.data, expectedUserIdInput)
  const legacy = remoteShadowSchema.parse(input)
  return validateRemoteShadowV2(
    { ...legacy, version: 2, kind: "item" },
    expectedUserIdInput
  )
}
