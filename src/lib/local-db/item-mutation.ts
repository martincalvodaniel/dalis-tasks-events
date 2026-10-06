"use client"

import { calendarItemSchema } from "@/schemas/calendar-item"
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
    return calendarItemSchema.parse({
      ...command.input,
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
    return calendarItemSchema.parse({
      ...current,
      ...command.input,
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
      "Status changes require a non-recurring task; occurrences use their own mutation layer"
    )
  }
  return calendarItemSchema.parse({
    ...current,
    status: command.status,
    completedAt:
      command.status === "completed" ? (current.completedAt ?? now) : null,
    updatedAt: now,
  })
}
