import { z } from "zod"
import {
  checklistSchema,
  eventScheduleSchema,
  taskStatusSchema,
} from "@/schemas/calendar-item"
import {
  civilDateSchema,
  entityIdSchema,
  localDateTimeSchema,
  occurrenceIdSchema,
  recordMetadataShape,
  timestampSchema,
} from "@/schemas/primitives"

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
