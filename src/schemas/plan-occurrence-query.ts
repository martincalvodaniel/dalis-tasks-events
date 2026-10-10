import { z } from "zod"
import {
  civilDateSchema,
  localDateTimeSchema,
  occurrenceIdSchema,
} from "@/schemas/primitives"
import { recurrenceQuerySchema } from "@/schemas/recurrence-query"

export const generatedPlanQuerySchema = recurrenceQuerySchema.safeExtend({
  includeCompleted: z.boolean().default(true),
})

export const planExceptionCursorSchema = z.strictObject({
  start: z.union([civilDateSchema, localDateTimeSchema]),
  id: occurrenceIdSchema,
})

export const planExceptionQuerySchema = z
  .strictObject({
    startDate: civilDateSchema,
    endDate: civilDateSchema,
    limit: z.number().int().min(1).max(500).default(100),
    includeCompleted: z.boolean().default(true),
    after: planExceptionCursorSchema.nullable().default(null),
  })
  .superRefine((query, context) => {
    if (query.endDate < query.startDate)
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Plan exception range end precedes its start",
      })
    // An interval carried into the query can start before startDate.
    if (query.after && query.after.start.slice(0, 10) > query.endDate)
      context.addIssue({
        code: "custom",
        path: ["after"],
        message: "Plan exception cursor starts after the requested range",
      })
  })
