import type { z } from "zod"
import type {
  localPlanOccurrenceOutcomeSchema,
  localPlanOccurrenceResultInputSchema,
  remotePlanOccurrenceShadowSchema,
  remoteRecurringShadowSchema,
} from "@/schemas/local-plan-occurrence-sync"
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
export type LocalPlanOccurrenceResultInput = z.infer<
  typeof localPlanOccurrenceResultInputSchema
>
export type LocalPlanOccurrenceOutcome = z.infer<
  typeof localPlanOccurrenceOutcomeSchema
>
export type RemotePlanOccurrenceShadow = z.infer<
  typeof remotePlanOccurrenceShadowSchema
>
export type RemoteRecurringShadow = z.infer<typeof remoteRecurringShadowSchema>
