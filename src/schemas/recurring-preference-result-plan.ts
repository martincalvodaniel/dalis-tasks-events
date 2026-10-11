import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { remoteRecurringShadowSchema } from "@/schemas/local-plan-occurrence-sync"
import { preferenceResultPlanInputSchema } from "@/schemas/preference-result-plan"

export const recurringPreferenceResultPlanInputSchema =
  preferenceResultPlanInputSchema.extend({
    items: z.array(calendarItemSchema).max(10000),
    shadows: z.array(remoteRecurringShadowSchema).max(10000),
  })
