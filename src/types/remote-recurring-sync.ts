import type { z } from "zod"
import type {
  remotePlanOccurrenceChangeSchema,
  remotePlanOccurrenceResultSchema,
  remoteRecurringOperationReceiptSchema,
  remoteRecurringOperationResultSchema,
} from "@/schemas/remote-plan-occurrence-result"

export type RemotePlanOccurrenceResult = z.infer<
  typeof remotePlanOccurrenceResultSchema
>
export type RemoteRecurringOperationResult = z.infer<
  typeof remoteRecurringOperationResultSchema
>
export type RemoteRecurringOperationReceipt = z.infer<
  typeof remoteRecurringOperationReceiptSchema
>
export type RemotePlanOccurrenceChange = z.infer<
  typeof remotePlanOccurrenceChangeSchema
>
