import { z } from "zod"
import {
  checklistEntrySchema,
  checklistSchema,
  eventScheduleSchema,
  taskStatusSchema,
} from "@/schemas/calendar-item"
import { occurrenceContentSchema } from "@/schemas/occurrence-content"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import {
  civilDateSchema,
  entityIdSchema,
  localDateTimeSchema,
  occurrenceIdSchema,
  recordMetadataShape,
  timestampSchema,
} from "@/schemas/primitives"

export { occurrenceContentSchema } from "@/schemas/occurrence-content"
export const taskOccurrenceInputSchema = z.strictObject({
  ...occurrenceContentSchema.shape,
  scheduledDate: civilDateSchema,
  checklist: z
    .array(checklistEntrySchema.omit({ completed: true }))
    .max(100)
    .refine(
      (entries) =>
        new Set(entries.map((entry) => entry.id)).size === entries.length,
      "Duplicate checklist identifiers"
    ),
})

const base = {
  id: occurrenceIdSchema,
  seriesId: entityIdSchema,
  slotKey: z.union([civilDateSchema, localDateTimeSchema]),
  cancelled: z.boolean(),
  ...recordMetadataShape,
}
export const itemOccurrenceSchema = z
  .discriminatedUnion("kind", [
    planOccurrenceSchema,
    z.strictObject({
      ...base,
      kind: z.literal("task"),
      content: occurrenceContentSchema.optional(),
      scheduledDate: civilDateSchema,
      status: taskStatusSchema,
      checklist: checklistSchema,
      completedAt: timestampSchema.nullable(),
    }),
    z.strictObject({
      ...base,
      kind: z.literal("event"),
      schedule: eventScheduleSchema,
    }),
    z.strictObject({
      ...base,
      kind: z.literal("birthday"),
      date: civilDateSchema,
    }),
  ])
  .refine(
    (occurrence) =>
      occurrence.id === `${occurrence.seriesId}:${occurrence.slotKey}`,
    "Occurrence identity must preserve its original slot"
  )
