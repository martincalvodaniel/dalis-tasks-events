import { planCommandSchema } from "@/schemas/plan-command"
import { planInputSchema } from "@/schemas/plan-input"
import { planSchema } from "@/schemas/plan-item"
import { timestampSchema, userIdSchema } from "@/schemas/primitives"
import type { Plan } from "@/types/plan-item"

export function applyPlanCommand(
  currentInput: Plan | null,
  commandInput: unknown,
  userId: string,
  timestamp: string
): Plan {
  const command = planCommandSchema.parse(commandInput)
  const actor = userIdSchema.parse(userId)
  const now = timestampSchema.parse(timestamp)
  const current = currentInput === null ? null : planSchema.parse(currentInput)
  if (command.type === "item.create") {
    if (current)
      throw new Error("Plan already exists, including deleted records")
    planInputSchema.parse(command.input)
    return planSchema.parse({
      ...command.input,
      id: command.itemId,
      ownerId: actor,
      revision: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      completedAt: command.input.status === "completed" ? now : null,
    })
  }
  if (!current || current.id !== command.itemId || current.deletedAt)
    throw new Error("Active plan does not exist")
  if (current.ownerId !== actor)
    throw new Error("Plan editing permission is unavailable")
  if (command.type === "item.delete")
    return planSchema.parse({ ...current, deletedAt: now, updatedAt: now })
  if (command.type === "item.update") {
    planInputSchema.parse(command.input)
    return planSchema.parse({
      ...current,
      ...command.input,
      updatedAt: now,
      completedAt:
        command.input.status === "completed"
          ? (current.completedAt ?? now)
          : null,
    })
  }
  if (current.recurrence)
    throw new Error("Recurring plan progress requires its occurrence layer")
  if (command.type === "plan.set-status")
    return planSchema.parse({
      ...current,
      status: command.status,
      completedAt:
        command.status === "completed" ? (current.completedAt ?? now) : null,
      updatedAt: now,
    })
  if (!current.checklist.some((entry) => entry.id === command.entryId))
    throw new Error("Checklist entry does not exist")
  return planSchema.parse({
    ...current,
    checklist: current.checklist.map((entry) =>
      entry.id === command.entryId
        ? { ...entry, completed: command.completed }
        : entry
    ),
    updatedAt: now,
  })
}
