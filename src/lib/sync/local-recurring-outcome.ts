import { decodeLocalOperationOutcome } from "@/lib/sync/local-operation-outcome-v2"
import { validateLocalPlanOccurrenceOutcome } from "@/lib/sync/local-plan-occurrence-sync"
import { maximumLocalOperationOutcomeBytes } from "@/schemas/local-preference-outcome-v2"
import type { LocalOperationOutcomeV2 } from "@/types/local-operation-outcome-v2"
import type { LocalPlanOccurrenceOutcome } from "@/types/remote-recurring-sync"

export type LocalRecurringOutcome =
  | LocalOperationOutcomeV2
  | LocalPlanOccurrenceOutcome

// Future reader only: parsing evidence never confirms a commit, lease or account access.
export function decodeLocalRecurringOutcome(
  input: unknown,
  expectedUserId: unknown
): LocalRecurringOutcome {
  if (
    new TextEncoder().encode(JSON.stringify(input)).byteLength >
    maximumLocalOperationOutcomeBytes
  )
    throw new Error("Stored recurring outcome exceeds its byte limit")
  if (
    input &&
    typeof input === "object" &&
    "kind" in input &&
    input.kind === "plan-occurrence"
  )
    return validateLocalPlanOccurrenceOutcome(input, expectedUserId)
  return decodeLocalOperationOutcome(input, expectedUserId)
}
