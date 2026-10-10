import { z } from "zod"
import {
  checklistEntrySchema,
  eventScheduleSchema,
  taskStatusSchema,
} from "@/schemas/item-fields"
import { occurrenceContentSchema } from "@/schemas/occurrence"
import { entityIdSchema, occurrenceIdSchema } from "@/schemas/primitives"

const reference = { itemId: entityIdSchema, occurrenceId: occurrenceIdSchema }
export const planOccurrenceInputSchema = occurrenceContentSchema.extend({
  schedule: eventScheduleSchema,
  checklist: z
    .array(checklistEntrySchema.omit({ completed: true }))
    .max(100)
    .refine(
      (entries) =>
        new Set(entries.map((entry) => entry.id)).size === entries.length,
      "Duplicate occurrence checklist identifiers"
    ),
})
export const planOccurrenceCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...reference,
    type: z.literal("plan.set-occurrence-status"),
    status: taskStatusSchema,
  }),
  z.strictObject({
    ...reference,
    type: z.literal("plan.set-occurrence-checklist-entry"),
    entryId: entityIdSchema,
    completed: z.boolean(),
  }),
  z.strictObject({
    ...reference,
    type: z.literal("plan.update-occurrence"),
    input: planOccurrenceInputSchema,
  }),
  z.strictObject({ ...reference, type: z.literal("plan.cancel-occurrence") }),
])
