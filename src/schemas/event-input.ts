import { z } from "zod"
import { resolveEventSchedule } from "@/lib/calendar/event-time"
import { ZonedTimeError } from "@/lib/calendar/zoned-time"
import { eventDraftSchema } from "@/schemas/calendar-item"

export const eventInputSchema = eventDraftSchema.superRefine(
  (event, context) => {
    if (event.recurrence)
      context.addIssue({
        code: "custom",
        path: ["recurrence"],
        message: "Recurring event input requires its occurrence layer",
      })
    try {
      resolveEventSchedule(event.schedule)
    } catch (error) {
      if (error instanceof z.ZodError) return
      if (!(error instanceof RangeError)) throw error
      context.addIssue({
        code: "custom",
        path: ["schedule"],
        message: error.message,
        params: {
          timeReason:
            error instanceof ZonedTimeError ? error.reason : "invalid_duration",
        },
      })
    }
  }
)
