import { z } from "zod"
import { resolveEventSchedule } from "@/lib/calendar/event-time"
import { ZonedTimeError } from "@/lib/calendar/zoned-time"
import { planDraftSchema } from "@/schemas/plan-item"

export const planInputSchema = planDraftSchema.superRefine((plan, context) => {
  try {
    resolveEventSchedule(plan.schedule)
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
})
