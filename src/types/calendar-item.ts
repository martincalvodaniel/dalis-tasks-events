import type { z } from "zod"
import type {
  birthdaySchema,
  calendarItemDraftSchema,
  calendarItemSchema,
  checklistEntrySchema,
  eventSchema,
  taskSchema,
  taskStatusSchema,
} from "@/schemas/calendar-item"
import type { itemOccurrenceSchema } from "@/schemas/occurrence"
import type { recurrenceSchema } from "@/schemas/recurrence"

export type CalendarItem = z.infer<typeof calendarItemSchema>
export type CalendarItemDraft = z.infer<typeof calendarItemDraftSchema>
export type Task = z.infer<typeof taskSchema>
export type CalendarEvent = z.infer<typeof eventSchema>
export type Birthday = z.infer<typeof birthdaySchema>
export type TaskStatus = z.infer<typeof taskStatusSchema>
export type ChecklistEntry = z.infer<typeof checklistEntrySchema>
export type RecurrenceRule = z.infer<typeof recurrenceSchema>
export type ItemOccurrence = z.infer<typeof itemOccurrenceSchema>
