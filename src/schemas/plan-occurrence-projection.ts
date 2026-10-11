import { z } from "zod"
import {
  localPlanOccurrenceResultInputSchema,
  remotePlanOccurrenceShadowSchema,
  remoteRecurringShadowSchema,
} from "@/schemas/local-plan-occurrence-sync"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import { userIdSchema } from "@/schemas/primitives"
import { remotePlanOccurrenceKeySchema } from "@/schemas/remote-plan-occurrence-storage"

export const planOccurrenceProjectionInputSchema = z.strictObject({
  userId: userIdSchema,
  key: remotePlanOccurrenceKeySchema,
  series: planSchema.nullable(),
  local: planOccurrenceSchema.nullable(),
  shadow: remotePlanOccurrenceShadowSchema.nullable(),
  incoming: remotePlanOccurrenceShadowSchema.nullable(),
  entries: z.array(outboxEntrySchema).max(10000),
})
export const planOccurrenceResultPlanInputSchema = z.strictObject({
  userId: userIdSchema,
  submission: localPlanOccurrenceResultInputSchema,
  series: planSchema.nullable(),
  local: planOccurrenceSchema.nullable(),
  shadows: z.array(remoteRecurringShadowSchema).max(10000),
  entries: z.array(outboxEntrySchema).max(10000),
  existingOutcome: z.unknown().nullable(),
})
