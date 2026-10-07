import { z } from "zod"
import {
  checklistEntrySchema,
  checklistSchema,
  eventScheduleSchema,
  taskStatusSchema,
} from "@/schemas/calendar-item"
import {
  civilDateSchema,
  descriptionSchema,
  entityIdSchema,
  localDateTimeSchema,
  occurrenceIdSchema,
  recordMetadataShape,
  timestampSchema,
  titleSchema,
} from "@/schemas/primitives"

export const occurrenceContentSchema = z.strictObject({
  title: titleSchema,
  description: descriptionSchema,
})
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
