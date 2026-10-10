import { calendarItemDraftSchema } from "@/schemas/calendar-item"
import type { CalendarItem, CalendarItemDraft } from "@/types/calendar-item"

export function calendarItemToDraft(item: CalendarItem): CalendarItemDraft {
  const {
    id: _id,
    ownerId: _ownerId,
    revision: _revision,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    deletedAt: _deletedAt,
    ...content
  } = item
  if ("completedAt" in content) {
    const { completedAt: _completedAt, ...draft } = content
    return calendarItemDraftSchema.parse(draft)
  }
  return calendarItemDraftSchema.parse(content)
}
