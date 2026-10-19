import { z } from "zod"
import { maximumLocalOperationOutcomeBytes } from "@/schemas/local-preference-outcome-v2"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import { planOccurrenceCohortInputSchema } from "@/schemas/plan-occurrence-cohort"
import { entityIdSchema, occurrenceIdSchema } from "@/schemas/primitives"

export const planOccurrenceCohortComparisonInputSchema =
  planOccurrenceCohortInputSchema.safeExtend({
    occurrences: z.array(planOccurrenceSchema).max(10000),
    shadows: z.array(z.unknown()).max(10000),
    outcomes: z.array(z.unknown()).max(10000),
  })

export const planOccurrenceCohortComparisonSchema = z
  .strictObject({
    source: planOccurrenceCohortComparisonInputSchema,
    operationIds: z.array(entityIdSchema).min(2).max(10000),
    prerequisiteOperationIds: z.array(entityIdSchema).max(10000),
    slots: z
      .array(
        z.strictObject({
          occurrenceId: occurrenceIdSchema,
          operationIds: z.array(entityIdSchema).min(1).max(10000),
          local: planOccurrenceSchema.nullable(),
          remote: planOccurrenceSchema,
        })
      )
      .min(2)
      .max(10000),
  })
  .refine(
    (value) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      maximumLocalOperationOutcomeBytes,
    "Appearance cohort comparison exceeds its byte limit"
  )
