import { z } from "zod"
import {
  civilDateSchema,
  entityIdSchema,
  localDateTimeSchema,
  timeZoneSchema,
} from "@/schemas/primitives"
export const taskStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "completed",
])
export const checklistEntrySchema = z.strictObject({
  id: entityIdSchema,
  text: z.string().trim().min(1).max(500),
  completed: z.boolean(),
})
export const checklistSchema = z
  .array(checklistEntrySchema)
  .max(100)
  .refine(
    (entries) =>
      new Set(entries.map((entry) => entry.id)).size === entries.length,
    "Duplicate checklist identifiers"
  )

export const eventScheduleSchema = z.discriminatedUnion("mode", [
  z
    .strictObject({
      mode: z.literal("all_day"),
      startDate: civilDateSchema,
      endDateExclusive: civilDateSchema,
    })
    .refine(
      (schedule) => schedule.endDateExclusive > schedule.startDate,
      "Event end must follow its start"
    ),
  z
    .strictObject({
      mode: z.literal("timed"),
      localStart: localDateTimeSchema,
      localEnd: localDateTimeSchema.nullable(),
      timeZone: timeZoneSchema,
    })
    .refine(
      (schedule) =>
        !schedule.localEnd || schedule.localEnd > schedule.localStart,
      "Event end must follow its start"
    ),
])
