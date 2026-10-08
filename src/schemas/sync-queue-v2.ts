import { z } from "zod"
import { syncQueueSummarySchema } from "@/schemas/sync-queue"

export const syncQueueSummaryV2Schema = syncQueueSummarySchema
  .safeExtend({
    personalUnresolved: z.number().int().min(0),
    personalProjectionBlocked: z.boolean(),
  })
  .refine(
    (value) =>
      value.personalProjectionBlocked === value.personalUnresolved > 0 &&
      value.personalUnresolved <=
        value.pending + value.sending + value.conflicts + value.rejected,
    "Personal queue summary is inconsistent"
  )
