import type { z } from "zod"
import { occurrencesPage } from "@/lib/calendar/occurrences"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { itemOccurrenceSchema } from "@/schemas/occurrence"
import {
  civilDateSchema,
  entityIdSchema,
  userIdSchema,
} from "@/schemas/primitives"
import {
  generatedTaskQuerySchema,
  type taskExceptionCursorSchema,
  taskExceptionQuerySchema,
} from "@/schemas/task-occurrence-query"
import type { CalendarItem, ItemOccurrence, Task } from "@/types/calendar-item"

type TaskOccurrence = Extract<ItemOccurrence, { kind: "task" }>
export interface TaskOccurrenceView {
  seriesId: string
  title: string
  description: string
  occurrence: TaskOccurrence
}
export interface GeneratedTaskPage {
  views: TaskOccurrenceView[]
  nextAfter: string | null
}
export interface TaskExceptionPage {
  views: TaskOccurrenceView[]
  nextCursor: z.infer<typeof taskExceptionCursorSchema> | null
}
function compareIdentity(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1
}
function compareOccurrences(
  left: TaskOccurrence,
  right: TaskOccurrence
): number {
  return (
    compareIdentity(left.scheduledDate, right.scheduledDate) ||
    compareIdentity(left.id, right.id)
  )
}
function view(series: Task, occurrence: ItemOccurrence): TaskOccurrenceView {
  const record = itemOccurrenceSchema.parse(occurrence)
  if (record.kind !== "task")
    throw new Error("Task selection cannot change occurrence kind")
  return {
    seriesId: series.id,
    title: record.content?.title ?? series.title,
    description: record.content?.description ?? series.description,
    occurrence: record,
  }
}

export function createTaskOccurrenceIndex(
  itemsInput: readonly CalendarItem[],
  occurrencesInput: readonly ItemOccurrence[],
  userId: string
) {
  const actor = userIdSchema.parse(userId)
  const series = new Map<string, Task>()
  for (const input of itemsInput) {
    const item = calendarItemSchema.parse(input)
    if (
      item.kind !== "task" ||
      !item.recurrence ||
      item.deletedAt ||
      item.ownerId !== actor
    )
      continue
    if (series.has(item.id)) throw new Error("Duplicate task series identity")
    series.set(item.id, item)
  }
  const exceptions = new Map<string, TaskOccurrence>()
  for (const input of occurrencesInput) {
    const occurrence = itemOccurrenceSchema.parse(input)
    if (occurrence.kind !== "task" || !series.has(occurrence.seriesId)) continue
    civilDateSchema.parse(occurrence.slotKey)
    if (exceptions.has(occurrence.id))
      throw new Error("Duplicate task occurrence identity")
    exceptions.set(occurrence.id, occurrence)
  }
  const visibleExceptions = [...exceptions.values()]
    .filter((occurrence) => !occurrence.cancelled && !occurrence.deletedAt)
    .toSorted(compareOccurrences)
  const pendingExceptions = visibleExceptions.filter(
    (occurrence) => occurrence.status !== "completed"
  )
  return {
    seriesIds: Object.freeze([...series.keys()].toSorted(compareIdentity)),
    generatedPage(
      seriesId: string,
      input: z.input<typeof generatedTaskQuerySchema>
    ): GeneratedTaskPage {
      const { includeCompleted, ...query } =
        generatedTaskQuerySchema.parse(input)
      const parent = series.get(entityIdSchema.parse(seriesId))
      if (!parent) return { views: [], nextAfter: null }
      const page = occurrencesPage(parent, query)
      return {
        views: page.occurrences
          .filter(
            (occurrence) =>
              !exceptions.has(occurrence.id) &&
              occurrence.kind === "task" &&
              (includeCompleted || occurrence.status !== "completed")
          )
          .map((occurrence) => view(parent, occurrence)),
        nextAfter: page.nextAfter,
      }
    },
    exceptionsPage(
      input: z.input<typeof taskExceptionQuerySchema>
    ): TaskExceptionPage {
      const query = taskExceptionQuerySchema.parse(input)
      const source = query.includeCompleted
        ? visibleExceptions
        : pendingExceptions
      let low = 0
      let high = source.length
      while (low < high) {
        const middle = Math.floor((low + high) / 2)
        const occurrence = source[middle]
        const precedes = query.after
          ? occurrence.scheduledDate < query.after.date ||
            (occurrence.scheduledDate === query.after.date &&
              occurrence.id <= query.after.id)
          : occurrence.scheduledDate < query.startDate
        if (precedes) low = middle + 1
        else high = middle
      }
      const matches = source
        .slice(low, low + query.limit + 1)
        .filter((occurrence) => occurrence.scheduledDate <= query.endDate)
      const selected = matches.slice(0, query.limit)
      const last = selected.at(-1)
      return {
        views: selected.map((occurrence) => {
          const parent = series.get(occurrence.seriesId)
          if (!parent) throw new Error("Prepared task series is unavailable")
          return view(parent, occurrence)
        }),
        nextCursor:
          matches.length > query.limit && last
            ? { date: last.scheduledDate, id: last.id }
            : null,
      }
    },
  }
}
