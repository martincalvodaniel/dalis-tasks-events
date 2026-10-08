import { userIdSchema } from "@/schemas/primitives"
import { remoteOperationResultV2Schema } from "@/schemas/remote-operation-result-v2"
import { remoteOperationResultSchema } from "@/schemas/remote-sync"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"

export function validateRemoteOperationResultV2(
  input: unknown,
  expectedUserIdInput: unknown
): RemoteOperationResultV2 {
  const expectedUserId = userIdSchema.parse(expectedUserIdInput)
  const result = remoteOperationResultV2Schema.parse(input)
  let owner: string | undefined
  if (result.kind === "item") {
    if (result.outcome.status === "applied") owner = result.outcome.item.ownerId
    else if (result.outcome.status === "conflict")
      owner = result.outcome.current.ownerId
  } else if (result.outcome.status === "applied") {
    owner = result.outcome.effects.userId
  } else if (result.outcome.status === "conflict") {
    owner = result.outcome.current.record.userId
  }
  if (owner !== undefined && owner !== expectedUserId)
    throw new Error("Remote operation result belongs to another account")
  // Error outcomes carry no document; they cannot establish ownership or an ACK.
  return result
}

export function decodeRemoteOperationResult(
  input: unknown,
  expectedUserIdInput: unknown
): RemoteOperationResultV2 {
  const versioned = remoteOperationResultV2Schema.safeParse(input)
  if (versioned.success)
    return validateRemoteOperationResultV2(versioned.data, expectedUserIdInput)
  const legacy = remoteOperationResultSchema.parse(input)
  return validateRemoteOperationResultV2(
    { kind: "item", outcome: legacy },
    expectedUserIdInput
  )
}
