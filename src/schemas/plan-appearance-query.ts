import { z } from "zod"
import { planExceptionCursorSchema } from "@/schemas/plan-occurrence-query"
import { civilDateSchema, entityIdSchema } from "@/schemas/primitives"

export const planAppearanceQuerySchema = z
  .strictObject({
    startDate: civilDateSchema,
    endDate: civilDateSchema,
    limit: z.number().int().min(1).max(500).default(50),
    includeCompleted: z.boolean().default(true),
  })
  .refine(
    (query) => query.endDate >= query.startDate,
    "Plan appearance range end precedes its start"
  )

export const planAppearanceCursorSchema = z.discriminatedUnion("phase", [
  z.strictObject({
    phase: z.literal("exceptions"),
    after: planExceptionCursorSchema.nullable(),
  }),
  z.strictObject({
    phase: z.literal("generated"),
    seriesId: entityIdSchema,
    afterDate: civilDateSchema.nullable(),
  }),
])
export type PlanAppearanceCursor = z.infer<typeof planAppearanceCursorSchema>
