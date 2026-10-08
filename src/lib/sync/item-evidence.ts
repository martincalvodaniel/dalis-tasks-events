import { decodeLocalOperationOutcome } from "@/lib/sync/local-operation-outcome-v2"
import { decodeRemoteShadow } from "@/lib/sync/remote-shadow-v2"
import { localOperationOutcomeSchema } from "@/schemas/local-sync"
import type { RemoteShadow } from "@/types/local-sync"

// Existing item APIs retain their shape; adaptation never rewrites durable evidence.
export function readItemShadow(input: unknown, userId: string): RemoteShadow {
  const shadow = decodeRemoteShadow(input, userId)
  if (shadow.kind !== "item")
    throw new Error("Item reader cannot consume personal shadow evidence")
  return { entityKey: shadow.entityKey, record: shadow.record }
}

export function readItemOutcome(input: unknown, userId: string) {
  const outcome = decodeLocalOperationOutcome(input, userId)
  if (outcome.kind !== "item")
    throw new Error("Item reader cannot consume personal outcome evidence")
  return localOperationOutcomeSchema.parse({
    key: outcome.key,
    operation: outcome.operation,
    result: outcome.result.outcome,
    local: outcome.local,
    base: outcome.base,
  })
}
