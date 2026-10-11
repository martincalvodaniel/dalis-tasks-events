import type { z } from "zod"
import type {
  remotePlanOccurrenceChangeSchema,
  remotePlanOccurrenceResultSchema,
  remoteRecurringOperationReceiptSchema,
  remoteRecurringOperationResultSchema,
} from "@/schemas/remote-plan-occurrence-result"
import type {
  remoteRecurringChangeSchema,
  remoteRecurringChangesPageSchema,
} from "@/schemas/remote-recurring-changes"

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
export type RemoteRecurringChange = z.infer<typeof remoteRecurringChangeSchema>
export type RemoteRecurringChangesPage = z.infer<
  typeof remoteRecurringChangesPageSchema
>
