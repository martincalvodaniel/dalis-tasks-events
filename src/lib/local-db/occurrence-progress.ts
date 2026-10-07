"use client"

import { occurrencesPage } from "@/lib/calendar/occurrences"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { itemOccurrenceSchema } from "@/schemas/occurrence"
import {
  civilDateSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { syncCommandSchema } from "@/schemas/sync"
import type { CalendarItem, ItemOccurrence } from "@/types/calendar-item"
import type { LocalItemCommand } from "@/types/local-sync"

export type OccurrenceProgressCommand = Extract<
  LocalItemCommand,
  { type: "task.set-status" | "task.set-checklist-entry" }
>

export function applyLocalOccurrenceProgress(
  seriesInput: CalendarItem | null,
  currentInput: ItemOccurrence | null,
  input: OccurrenceProgressCommand,
  userId: string,
  timestamp: string
): Extract<ItemOccurrence, { kind: "task" }> {
  const actor = userIdSchema.parse(userId)
  const now = timestampSchema.parse(timestamp)
  const command = syncCommandSchema.parse(input)
  if (
    (command.type !== "task.set-status" &&
      command.type !== "task.set-checklist-entry") ||
    !command.occurrenceId
  )
    throw new Error("Occurrence progress requires its original identity")
  const series = seriesInput ? calendarItemSchema.parse(seriesInput) : null
  if (
    series?.kind !== "task" ||
    series.id !== command.itemId ||
    !series.recurrence ||
    series.deletedAt ||
    series.ownerId !== actor
  )
    throw new Error("Active recurring task editing permission is unavailable")
  const prefix = `${series.id}:`
  if (!command.occurrenceId.startsWith(prefix))
    throw new Error("Occurrence belongs to a different series")
  const slotKey = civilDateSchema.parse(
    command.occurrenceId.slice(prefix.length)
  )
  let current = currentInput ? itemOccurrenceSchema.parse(currentInput) : null
  if (!current) {
    current =
      occurrencesPage(series, {
        startDate: slotKey,
        endDate: slotKey,
        limit: 1,
      }).occurrences[0] ?? null
    if (!current)
      throw new Error("Occurrence slot does not belong to the series")
  }
  if (
    current.kind !== "task" ||
    current.id !== command.occurrenceId ||
    current.seriesId !== series.id ||
    current.slotKey !== slotKey ||
    current.cancelled ||
    current.deletedAt
  )
    throw new Error("Active task occurrence does not exist")
  if (
    command.type === "task.set-checklist-entry" &&
    !current.checklist.some((entry) => entry.id === command.entryId)
  )
    throw new Error("Occurrence checklist entry does not exist")
  const record = itemOccurrenceSchema.parse({
    ...current,
    createdAt: currentInput ? current.createdAt : now,
    updatedAt: now,
    ...(command.type === "task.set-status"
      ? {
          status: command.status,
          completedAt:
            command.status === "completed"
              ? (current.completedAt ?? now)
              : null,
        }
      : {
          checklist: current.checklist.map((entry) =>
            entry.id === command.entryId
              ? { ...entry, completed: command.completed }
              : entry
          ),
        }),
  })
  if (record.kind !== "task")
    throw new Error("Task occurrence kind cannot change")
  return record
}
