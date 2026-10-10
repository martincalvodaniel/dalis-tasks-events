import { resolveEventSchedule } from "@/lib/calendar/event-time"
import { planOccurrencesPage } from "@/lib/calendar/plan-occurrences"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import { planOccurrenceCommandSchema } from "@/schemas/plan-occurrence-command"
import {
  civilDateSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import type { Plan } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"

export function editablePlanOccurrence(
  seriesInput: Plan | null,
  currentInput: PlanOccurrence | null,
  commandInput: unknown,
  userId: string
) {
  const actor = userIdSchema.parse(userId)
  const command = planOccurrenceCommandSchema.parse(commandInput)
  const series = seriesInput ? planSchema.parse(seriesInput) : null
  if (
    !series ||
    series.ownerId !== actor ||
    series.id !== command.itemId ||
    !series.recurrence ||
    series.deletedAt
  )
    throw new Error("Active recurring plan editing permission is unavailable")
  const prefix = `${series.id}:`
  if (!command.occurrenceId.startsWith(prefix))
    throw new Error("Plan occurrence belongs to a different series")
  const slotKey = command.occurrenceId.slice(prefix.length)
  const date = civilDateSchema.parse(slotKey.slice(0, 10))
  const current = currentInput
    ? planOccurrenceSchema.parse(currentInput)
    : planOccurrencesPage(series, {
        startDate: date,
        endDate: date,
        limit: 1,
      }).occurrences.find((record) => record.id === command.occurrenceId)
  if (
    !current ||
    current.seriesId !== series.id ||
    current.id !== command.occurrenceId ||
    current.slotKey !== slotKey ||
    current.cancelled ||
    current.deletedAt
  )
    throw new Error("Active plan occurrence does not exist")
  return { series, current }
}

export function applyPlanOccurrenceCommand(
  seriesInput: Plan | null,
  currentInput: PlanOccurrence | null,
  commandInput: unknown,
  userId: string,
  timestamp: string
): PlanOccurrence {
  const now = timestampSchema.parse(timestamp)
  const command = planOccurrenceCommandSchema.parse(commandInput)
  const { series, current } = editablePlanOccurrence(
    seriesInput,
    currentInput,
    command,
    userId
  )
  const record = {
    ...current,
    content: current.content ?? {
      title: series.title,
      description: series.description,
    },
    createdAt: currentInput ? current.createdAt : now,
    updatedAt: now,
  }
  if (command.type === "plan.cancel-occurrence")
    return planOccurrenceSchema.parse({ ...record, cancelled: true })
  if (command.type === "plan.set-occurrence-status")
    return planOccurrenceSchema.parse({
      ...record,
      status: command.status,
      completedAt:
        command.status === "completed" ? (current.completedAt ?? now) : null,
    })
  if (command.type === "plan.set-occurrence-checklist-entry") {
    if (!current.checklist.some((entry) => entry.id === command.entryId))
      throw new Error("Plan occurrence checklist entry does not exist")
    return planOccurrenceSchema.parse({
      ...record,
      checklist: current.checklist.map((entry) =>
        entry.id === command.entryId
          ? { ...entry, completed: command.completed }
          : entry
      ),
    })
  }
  resolveEventSchedule(command.input.schedule)
  const completed = new Map(
    current.checklist.map((entry) => [entry.id, entry.completed])
  )
  return planOccurrenceSchema.parse({
    ...record,
    content: {
      title: command.input.title,
      description: command.input.description,
    },
    schedule: command.input.schedule,
    checklist: command.input.checklist.map((entry) => ({
      ...entry,
      completed: completed.get(entry.id) ?? false,
    })),
  })
}
