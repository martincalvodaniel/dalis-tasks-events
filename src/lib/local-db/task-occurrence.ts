"use client"

import { occurrencesPage } from "@/lib/calendar/occurrences"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { itemOccurrenceSchema } from "@/schemas/occurrence"
import { civilDateSchema, userIdSchema } from "@/schemas/primitives"
import type { CalendarItem, ItemOccurrence } from "@/types/calendar-item"

export function editableTaskOccurrence(
  seriesInput: CalendarItem | null,
  currentInput: ItemOccurrence | null,
  occurrenceId: string,
  itemId: string,
  userId: string
) {
  const actor = userIdSchema.parse(userId)
  const series = seriesInput ? calendarItemSchema.parse(seriesInput) : null
  if (
    series?.kind !== "task" ||
    series.id !== itemId ||
    !series.recurrence ||
    series.deletedAt ||
    series.ownerId !== actor
  )
    throw new Error("Active recurring task editing permission is unavailable")
  const prefix = `${series.id}:`
  if (!occurrenceId.startsWith(prefix))
    throw new Error("Occurrence belongs to a different series")
  const slotKey = civilDateSchema.parse(occurrenceId.slice(prefix.length))
  const current = currentInput
    ? itemOccurrenceSchema.parse(currentInput)
    : occurrencesPage(series, {
        startDate: slotKey,
        endDate: slotKey,
        limit: 1,
      }).occurrences[0]
  if (!current) throw new Error("Occurrence slot does not belong to the series")
  if (
    current.kind !== "task" ||
    current.id !== occurrenceId ||
    current.seriesId !== series.id ||
    current.slotKey !== slotKey ||
    current.cancelled ||
    current.deletedAt
  )
    throw new Error("Active task occurrence does not exist")
  return { series, current }
}
