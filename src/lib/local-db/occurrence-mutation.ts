"use client"

import { editableTaskOccurrence } from "@/lib/local-db/task-occurrence"
import { itemOccurrenceSchema } from "@/schemas/occurrence"
import { timestampSchema } from "@/schemas/primitives"
import { syncCommandSchema } from "@/schemas/sync"
import type { CalendarItem, ItemOccurrence } from "@/types/calendar-item"
import type { LocalOccurrenceCommand } from "@/types/local-sync"

export function applyLocalOccurrenceCommand(
  seriesInput: CalendarItem | null,
  currentInput: ItemOccurrence | null,
  input: LocalOccurrenceCommand,
  userId: string,
  timestamp: string
): Extract<ItemOccurrence, { kind: "task" }> {
  const command = syncCommandSchema.parse(input)
  const now = timestampSchema.parse(timestamp)
  if (
    command.type !== "task.update-occurrence" &&
    command.type !== "task.cancel-occurrence"
  )
    throw new Error("Command requires task occurrence editing")
  const { series, current } = editableTaskOccurrence(
    seriesInput,
    currentInput,
    command.occurrenceId,
    command.itemId,
    userId
  )
  const completed = new Map(
    current.checklist.map((entry) => [entry.id, entry.completed])
  )
  const record = itemOccurrenceSchema.parse({
    ...current,
    content: current.content ?? {
      title: series.title,
      description: series.description,
    },
    createdAt: currentInput ? current.createdAt : now,
    updatedAt: now,
    ...(command.type === "task.cancel-occurrence"
      ? { cancelled: true }
      : {
          content: {
            title: command.input.title,
            description: command.input.description,
          },
          scheduledDate: command.input.scheduledDate,
          checklist: command.input.checklist.map((entry) => ({
            ...entry,
            completed: completed.get(entry.id) ?? false,
          })),
        }),
  })
  if (record.kind !== "task")
    throw new Error("Task occurrence kind cannot change")
  return record
}
