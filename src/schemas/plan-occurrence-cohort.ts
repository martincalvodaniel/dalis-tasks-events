import { z } from "zod"
import { maximumLocalOperationOutcomeBytes } from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"
import { entityIdSchema, userIdSchema } from "@/schemas/primitives"
export const planOccurrenceCohortInputSchema = z
  .strictObject({
    userId: userIdSchema,
    operationId: entityIdSchema,
    series: planSchema,
    entries: z.array(outboxEntrySchema).max(10000),
  })
  .refine(
    (value) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      maximumLocalOperationOutcomeBytes,
    "Appearance cohort exceeds its byte limit"
  )
