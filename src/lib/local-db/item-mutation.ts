"use client"

import { calendarItemSchema } from "@/schemas/calendar-item"
import { eventInputSchema } from "@/schemas/event-input"
import { timestampSchema, userIdSchema } from "@/schemas/primitives"
import type { CalendarItem } from "@/types/calendar-item"
import type { LocalItemCommand } from "@/types/local-sync"

export function applyLocalItemCommand(
  current: CalendarItem | null,
  command: LocalItemCommand,
  userId: string,
  timestamp: string
): CalendarItem {
  const actor = userIdSchema.parse(userId)
  const now = timestampSchema.parse(timestamp)
  if (command.type === "item.create") {
    if (current)
      throw new Error("Item already exists, including deleted records")
    const input =
      command.input.kind === "event"
        ? eventInputSchema.parse(command.input)
        : command.input
    return calendarItemSchema.parse({
      ...input,
      id: command.itemId,
      ownerId: actor,
      revision: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      ...(command.input.kind === "task"
        ? { completedAt: command.input.status === "completed" ? now : null }
        : {}),
    })
  }
  if (!current || current.id !== command.itemId || current.deletedAt) {
    throw new Error("Active item does not exist")
  }
  if (current.ownerId !== actor)
    throw new Error("Local editing permission is unavailable")
  if (command.type === "item.delete") {
    return calendarItemSchema.parse({
      ...current,
      deletedAt: now,
      updatedAt: now,
    })
  }
  if (command.type === "item.update") {
    if (current.kind !== command.input.kind)
      throw new Error("Item kind cannot change")
    const input =
      command.input.kind === "event"
        ? eventInputSchema.parse(command.input)
        : command.input
    return calendarItemSchema.parse({
      ...current,
      ...input,
      updatedAt: now,
      ...(command.input.kind === "task"
        ? {
            completedAt:
              command.input.status === "completed"
                ? current.kind === "task" && current.completedAt
                  ? current.completedAt
                  : now
                : null,
          }
        : {}),
    })
  }
  if (current.kind !== "task" || command.occurrenceId || current.recurrence) {
    throw new Error(
      "Task progress requires a non-recurring task; occurrences use their own mutation layer"
    )
  }
  if (command.type === "task.set-checklist-entry") {
    if (!current.checklist.some((entry) => entry.id === command.entryId))
      throw new Error("Checklist entry does not exist")
    return calendarItemSchema.parse({
      ...current,
      checklist: current.checklist.map((entry) =>
        entry.id === command.entryId
          ? { ...entry, completed: command.completed }
          : entry
      ),
      updatedAt: now,
    })
  }
  return calendarItemSchema.parse({
    ...current,
    status: command.status,
    completedAt:
      command.status === "completed" ? (current.completedAt ?? now) : null,
    updatedAt: now,
  })
}
