import type { z } from "zod"
import { diagnosePersonalQueue } from "@/lib/sync/personal-queue-diagnostics"
import {
  type SyncCapabilityPolicy,
  syncCapabilityPolicy,
} from "@/lib/sync/sync-capabilities"
import { syncQueueSummaryV2Schema } from "@/schemas/sync-queue-v2"

export type SyncQueueSummaryV2 = z.infer<typeof syncQueueSummaryV2Schema>

// This describes prepared capabilities and preserved intentions, not active transport or convergence.
export function summarizeSyncQueueV2(
  input: unknown,
  policy: SyncCapabilityPolicy = syncCapabilityPolicy
): SyncQueueSummaryV2 {
  const diagnostics = diagnosePersonalQueue(input, policy)
  const summary: SyncQueueSummaryV2 = {
    pending: 0,
    ready: 0,
    waiting: 0,
    blocked: 0,
    unsupported: 0,
    sending: 0,
    conflicts: 0,
    rejected: 0,
    personalUnresolved: diagnostics.personalProjectionBlockers.length,
    personalProjectionBlocked: diagnostics.personalProjectionBlocked,
  }
  for (const operation of diagnostics.operations) {
    switch (operation.entry.state) {
      case "pending":
        summary.pending++
        if (operation.category === "settled")
          throw new Error("Pending intention cannot have a settled diagnostic")
        summary[operation.category]++
        break
      case "sending":
        summary.sending++
        break
      case "conflict":
        summary.conflicts++
        break
      case "rejected":
        summary.rejected++
        break
      case "acknowledged":
      case "superseded":
        break
    }
  }
  return syncQueueSummaryV2Schema.parse(summary)
}
