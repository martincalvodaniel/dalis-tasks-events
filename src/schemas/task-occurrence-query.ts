import { z } from "zod"
import { civilDateSchema, occurrenceIdSchema } from "@/schemas/primitives"
import { recurrenceQuerySchema } from "@/schemas/recurrence-query"

export const generatedTaskQuerySchema = recurrenceQuerySchema.safeExtend({
  includeCompleted: z.boolean().default(true),
})
export const taskExceptionCursorSchema = z.strictObject({
  date: civilDateSchema,
  id: occurrenceIdSchema,
})
export const taskExceptionQuerySchema = z
  .strictObject({
    startDate: civilDateSchema,
    endDate: civilDateSchema,
    limit: z.number().int().min(1).max(500).default(100),
    includeCompleted: z.boolean().default(true),
    after: taskExceptionCursorSchema.nullable().default(null),
  })
  .superRefine((query, context) => {
    if (query.endDate < query.startDate)
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Task exception range end precedes its start",
      })
    if (
      query.after &&
      (query.after.date < query.startDate || query.after.date > query.endDate)
    )
      context.addIssue({
        code: "custom",
        path: ["after"],
        message: "Task exception cursor must belong to the requested range",
      })
  })
