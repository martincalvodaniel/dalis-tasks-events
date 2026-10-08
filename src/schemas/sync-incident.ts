import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import {
  localOperationOutcomeSchema,
  outboxEntrySchema,
  remoteShadowSchema,
} from "@/schemas/local-sync"
import { userIdSchema } from "@/schemas/primitives"

export const syncIncidentProjectionSchema = z.strictObject({
  userId: userIdSchema,
  entry: outboxEntrySchema,
  outcome: localOperationOutcomeSchema,
  local: calendarItemSchema.nullable(),
  remote: calendarItemSchema.nullable(),
})

export const syncIncidentSnapshotInputSchema = z.strictObject({
  userId: userIdSchema,
  entries: z.array(outboxEntrySchema),
  items: z.array(calendarItemSchema),
  shadows: z.array(remoteShadowSchema),
  outcomes: z.array(localOperationOutcomeSchema),
})
