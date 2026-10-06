import { z } from "zod"
import { civilDateSchema, timeZoneSchema } from "@/schemas/primitives"

const recurrenceEndSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("never") }),
  z.strictObject({ type: z.literal("until"), date: civilDateSchema }),
  z.strictObject({
    type: z.literal("count"),
    count: z.number().int().min(1).max(100000),
  }),
])
const base = {
  anchorDate: civilDateSchema,
  timeZone: timeZoneSchema,
  interval: z.number().int().min(1).max(365),
  end: recurrenceEndSchema,
}
export const recurrenceSchema = z
  .discriminatedUnion("frequency", [
    z.strictObject({ ...base, frequency: z.literal("daily") }),
    z.strictObject({
      ...base,
      frequency: z.literal("weekly"),
      weekdays: z
        .array(z.number().int().min(0).max(6))
        .min(1)
        .max(7)
        .refine(
          (days) => new Set(days).size === days.length,
          "Duplicate weekdays"
        ),
    }),
    z.strictObject({ ...base, frequency: z.literal("monthly") }),
    z.strictObject({ ...base, frequency: z.literal("yearly") }),
  ])
  .refine(
    (rule) => rule.end.type !== "until" || rule.end.date >= rule.anchorDate,
    "Recurrence ends before its anchor"
  )
