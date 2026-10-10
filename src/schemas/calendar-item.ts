import { z } from "zod"
import {
  checklistSchema,
  eventScheduleSchema,
  taskStatusSchema,
} from "@/schemas/item-fields"
import { planDraftSchema, planSchema } from "@/schemas/plan-item"

export {
  checklistEntrySchema,
  checklistSchema,
  eventScheduleSchema,
  taskStatusSchema,
} from "@/schemas/item-fields"

import {
  civilDateSchema,
  descriptionSchema,
  entityIdSchema,
  recordMetadataShape,
  timestampSchema,
  timeZoneSchema,
  titleSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { recurrenceSchema } from "@/schemas/recurrence"

const content = { title: titleSchema, description: descriptionSchema }
export const taskDraftSchema = z
  .strictObject({
    ...content,
    kind: z.literal("task"),
    scheduledDate: civilDateSchema,
    status: taskStatusSchema,
    checklist: checklistSchema,
    recurrence: recurrenceSchema.nullable(),
  })
  .refine(
    (task) =>
      !task.recurrence || task.recurrence.anchorDate === task.scheduledDate,
    "Task recurrence must start on its scheduled date"
  )

export const eventDraftSchema = z
  .strictObject({
    ...content,
    kind: z.literal("event"),
    schedule: eventScheduleSchema,
    recurrence: recurrenceSchema.nullable(),
  })
  .refine((event) => {
    if (!event.recurrence) return true
    const date =
      event.schedule.mode === "all_day"
        ? event.schedule.startDate
        : event.schedule.localStart.slice(0, 10)
    return (
      event.recurrence.anchorDate === date &&
      (event.schedule.mode === "all_day" ||
        event.recurrence.timeZone === event.schedule.timeZone)
    )
  }, "Event recurrence must match its start and time zone")
export const birthdayDraftSchema = z
  .strictObject({
    ...content,
    kind: z.literal("birthday"),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    birthYear: z.number().int().min(1).max(9999).nullable(),
    timeZone: timeZoneSchema,
  })
  .refine(
    (birthday) =>
      civilDateSchema.safeParse(
        `${String(birthday.birthYear ?? 2000).padStart(4, "0")}-${String(birthday.month).padStart(2, "0")}-${String(birthday.day).padStart(2, "0")}`
      ).success,
    "Invalid birthday date"
  )

export const calendarItemDraftSchema = z.discriminatedUnion("kind", [
  taskDraftSchema,
  eventDraftSchema,
  birthdayDraftSchema,
  planDraftSchema,
])
const identity = {
  id: entityIdSchema,
  ownerId: userIdSchema,
  ...recordMetadataShape,
}
export const taskSchema = taskDraftSchema.safeExtend({
  ...identity,
  completedAt: timestampSchema.nullable(),
})
export const eventSchema = eventDraftSchema.safeExtend(identity)
export const birthdaySchema = birthdayDraftSchema.safeExtend(identity)
export const calendarItemSchema = z.discriminatedUnion("kind", [
  taskSchema,
  eventSchema,
  birthdaySchema,
  planSchema,
])
