import { z } from "zod"
import {
  checklistSchema,
  eventScheduleSchema,
  taskStatusSchema,
} from "@/schemas/calendar-item"
import {
  descriptionSchema,
  entityIdSchema,
  recordMetadataShape,
  timestampSchema,
  titleSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { recurrenceSchema } from "@/schemas/recurrence"

export const planVariantSchema = z.enum([
  "task",
  "event",
  "appointment",
  "note",
])
export const planDraftSchema = z
  .strictObject({
    kind: z.literal("plan"),
    variant: planVariantSchema,
    title: titleSchema,
    description: descriptionSchema,
    schedule: eventScheduleSchema,
    status: taskStatusSchema,
    checklist: checklistSchema,
    recurrence: recurrenceSchema.nullable(),
  })
  .superRefine((plan, context) => {
    if (!plan.recurrence) return
    const startDate =
      plan.schedule.mode === "all_day"
        ? plan.schedule.startDate
        : plan.schedule.localStart.slice(0, 10)
    if (plan.recurrence.anchorDate !== startDate)
      context.addIssue({
        code: "custom",
        path: ["recurrence", "anchorDate"],
        message: "Plan recurrence must match its start date",
      })
    if (
      plan.schedule.mode === "timed" &&
      plan.recurrence.timeZone !== plan.schedule.timeZone
    )
      context.addIssue({
        code: "custom",
        path: ["recurrence", "timeZone"],
        message: "Plan recurrence must match its time zone",
      })
  })

export const planSchema = planDraftSchema
  .safeExtend({
    id: entityIdSchema,
    ownerId: userIdSchema,
    ...recordMetadataShape,
    completedAt: timestampSchema.nullable(),
  })
  .refine(
    (plan) => (plan.status === "completed") === (plan.completedAt !== null),
    "Plan completion timestamp must match its status"
  )
