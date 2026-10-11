import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { itemOccurrenceSchema } from "@/schemas/occurrence"
import { userIdSchema } from "@/schemas/primitives"

export const recurringIncidentSnapshotInputSchema = z.strictObject({
  userId: userIdSchema,
  items: z.array(calendarItemSchema).max(10000),
  occurrences: z.array(itemOccurrenceSchema).max(10000),
  entries: z.array(outboxEntrySchema).max(10000),
  shadows: z.array(z.unknown()).max(10000),
  outcomes: z.array(z.unknown()).max(10000),
})
