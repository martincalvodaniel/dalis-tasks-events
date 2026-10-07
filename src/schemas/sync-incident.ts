import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import {
  localOperationOutcomeSchema,
  outboxEntrySchema,
} from "@/schemas/local-sync"
import { userIdSchema } from "@/schemas/primitives"

export const syncIncidentProjectionSchema = z.strictObject({
  userId: userIdSchema,
  entry: outboxEntrySchema,
  outcome: localOperationOutcomeSchema,
  local: calendarItemSchema.nullable(),
  remote: calendarItemSchema.nullable(),
})
