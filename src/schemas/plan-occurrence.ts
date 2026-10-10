import { z } from "zod"
import {
  checklistSchema,
  eventScheduleSchema,
  taskStatusSchema,
} from "@/schemas/item-fields"
import { occurrenceContentSchema } from "@/schemas/occurrence-content"
import {
  civilDateSchema,
  entityIdSchema,
  localDateTimeSchema,
  occurrenceIdSchema,
  recordMetadataShape,
  timestampSchema,
} from "@/schemas/primitives"

// Variant and ownership remain on the parent; changing presentation never changes the original slot.
export const planOccurrenceSchema = z
  .strictObject({
    kind: z.literal("plan"),
    id: occurrenceIdSchema,
    seriesId: entityIdSchema,
    slotKey: z.union([civilDateSchema, localDateTimeSchema]),
    content: occurrenceContentSchema.optional(),
    schedule: eventScheduleSchema,
    status: taskStatusSchema,
    checklist: checklistSchema,
    completedAt: timestampSchema.nullable(),
    cancelled: z.boolean(),
    ...recordMetadataShape,
  })
  .refine(
    (value) => value.id === `${value.seriesId}:${value.slotKey}`,
    "Plan occurrence identity must preserve its original slot"
  )
  .refine(
    (value) => (value.status === "completed") === (value.completedAt !== null),
    "Plan occurrence completion timestamp must match its status"
  )
