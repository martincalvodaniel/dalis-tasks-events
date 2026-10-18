import type { z } from "zod"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import { planOccurrenceCommandSchema } from "@/schemas/plan-occurrence-command"
import type { Plan } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"

// Authorization, freshness and exact snapshot validation belong to the reviewed planner.
export function planOccurrenceRetryCommands(
  seriesInput: Plan,
  localInput: PlanOccurrence,
  remoteInput: PlanOccurrence
): z.infer<typeof planOccurrenceCommandSchema>[] {
  const series = planSchema.parse(seriesInput),
    local = planOccurrenceSchema.parse(localInput),
    remote = planOccurrenceSchema.parse(remoteInput)
  if (
    !series.recurrence ||
    series.deletedAt ||
    local.seriesId !== series.id ||
    remote.seriesId !== series.id ||
    local.id !== remote.id ||
    local.deletedAt ||
    remote.deletedAt ||
    remote.cancelled
  )
    throw new Error(
      "Appearance retry requires its own local draft and living remote slot"
    )
  const reference = { itemId: series.id, occurrenceId: local.id }
  const commands: z.infer<typeof planOccurrenceCommandSchema>[] = [
    {
      ...reference,
      type: "plan.update-occurrence",
      input: {
        title: local.content?.title ?? series.title,
        description: local.content?.description ?? series.description,
        schedule: local.schedule,
        checklist: local.checklist.map(({ id, text }) => ({ id, text })),
      },
    },
  ]
  if (local.status !== remote.status)
    commands.push({
      ...reference,
      type: "plan.set-occurrence-status",
      status: local.status,
    })
  const completed = new Map(
    remote.checklist.map((entry) => [entry.id, entry.completed])
  )
  for (const entry of local.checklist)
    if (entry.completed !== (completed.get(entry.id) ?? false))
      commands.push({
        ...reference,
        type: "plan.set-occurrence-checklist-entry",
        entryId: entry.id,
        completed: entry.completed,
      })
  if (local.cancelled)
    commands.push({ ...reference, type: "plan.cancel-occurrence" })
  return commands.map((command) => planOccurrenceCommandSchema.parse(command))
}
