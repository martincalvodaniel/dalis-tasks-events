import { z } from "zod"
import { civilDateSchema } from "@/schemas/primitives"

export const recurrenceQuerySchema = z
  .strictObject({
    startDate: civilDateSchema,
    endDate: civilDateSchema,
    afterDate: civilDateSchema.nullable().default(null),
    limit: z.number().int().min(1).max(500).default(100),
  })
  .superRefine((query, context) => {
    if (query.endDate < query.startDate)
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Recurrence range end precedes its start",
      })
    if (
      query.afterDate &&
      (query.afterDate < query.startDate || query.afterDate > query.endDate)
    )
      context.addIssue({
        code: "custom",
        path: ["afterDate"],
        message: "Recurrence cursor must belong to the requested range",
      })
  })
