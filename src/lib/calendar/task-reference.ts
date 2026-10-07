import { occurrencesPage } from "@/lib/calendar/occurrences"
import { calendarItemSchema, taskSchema } from "@/schemas/calendar-item"
import { itemOccurrenceSchema } from "@/schemas/occurrence"
import { taskReferenceIdSchema } from "@/schemas/ordering"
import { civilDateSchema, userIdSchema } from "@/schemas/primitives"
import type { CalendarItem, ItemOccurrence, Task } from "@/types/calendar-item"

export interface ActiveTaskReference {
  parent: Task
  record: Task | Extract<ItemOccurrence, { kind: "task" }>
}
export function createTaskReferenceIndex(
  itemsInput: readonly CalendarItem[],
  occurrencesInput: readonly ItemOccurrence[],
  userId: string
) {
  const actor = userIdSchema.parse(userId)
  const parents = new Map<string, Task>()
  for (const input of itemsInput) {
    const item = calendarItemSchema.parse(input)
    if (item.kind !== "task" || item.ownerId !== actor || item.deletedAt)
      continue
    if (parents.has(item.id)) throw new Error("Duplicate task reference parent")
    parents.set(item.id, item)
  }
  const exceptions = new Map<
    string,
    Extract<ItemOccurrence, { kind: "task" }>
  >()
  for (const input of occurrencesInput) {
    const occurrence = itemOccurrenceSchema.parse(input)
    if (occurrence.kind !== "task" || !parents.has(occurrence.seriesId))
      continue
    civilDateSchema.parse(occurrence.slotKey)
    if (exceptions.has(occurrence.id))
      throw new Error("Duplicate task reference exception")
    exceptions.set(occurrence.id, occurrence)
  }
  return {
    resolve(input: string): ActiveTaskReference | null {
      const identity = taskReferenceIdSchema.parse(input)
      const separator = identity.indexOf(":")
      const parentId = separator < 0 ? identity : identity.slice(0, separator)
      const parent = parents.get(parentId)
      if (!parent) return null
      if (separator < 0)
        return parent.recurrence
          ? null
          : {
              parent: taskSchema.parse(parent),
              record: taskSchema.parse(parent),
            }
      if (!parent.recurrence) return null
      const slotKey = identity.slice(separator + 1)
      const occurrence =
        exceptions.get(identity) ??
        occurrencesPage(parent, {
          startDate: slotKey,
          endDate: slotKey,
          limit: 1,
        }).occurrences[0]
      if (
        occurrence?.kind !== "task" ||
        occurrence.cancelled ||
        occurrence.deletedAt
      )
        return null
      const record = itemOccurrenceSchema.parse(occurrence)
      if (record.kind !== "task")
        throw new Error("Task reference kind cannot change")
      return { parent: taskSchema.parse(parent), record }
    },
  }
}
