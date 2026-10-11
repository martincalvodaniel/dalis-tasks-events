import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { remoteRecurringShadowSchema } from "@/schemas/local-plan-occurrence-sync"
import { localPullCursorSchema, outboxEntrySchema } from "@/schemas/local-sync"
import { itemOccurrenceSchema } from "@/schemas/occurrence"
import { personalSnapshotSchema } from "@/schemas/personal-snapshot"
import { userIdSchema } from "@/schemas/primitives"
import { remoteRecurringChangesPageSchema } from "@/schemas/remote-recurring-changes"
import { remotePullQuerySchema } from "@/schemas/remote-sync"

export const localRecurringChangesPageInputSchema = z.strictObject({
  query: remotePullQuerySchema,
  page: remoteRecurringChangesPageSchema,
})
export const localRecurringPullPlanInputSchema = z.strictObject({
  userId: userIdSchema,
  receipt: localRecurringChangesPageInputSchema,
  cursor: localPullCursorSchema,
  items: z.array(calendarItemSchema).max(10000),
  occurrences: z.array(itemOccurrenceSchema).max(10000),
  local: personalSnapshotSchema,
  entries: z.array(outboxEntrySchema).max(10000),
  shadows: z.array(remoteRecurringShadowSchema).max(10000),
})
