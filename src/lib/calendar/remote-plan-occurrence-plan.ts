import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import { planOccurrenceCommandSchema } from "@/schemas/plan-occurrence-command"
import {
  type RemotePlanOccurrencePlan,
  remotePlanOccurrencePlanningInputSchema,
  remotePlanOccurrencePlanSchema,
} from "@/schemas/remote-plan-occurrence-planning"

// Persistence, replay and the shared series guard belong to the transaction executor.
export function planRemotePlanOccurrenceOperation(
  input: unknown
): RemotePlanOccurrencePlan {
  const { userId, timestamp, operation, series, current } =
    remotePlanOccurrencePlanningInputSchema.parse(input)
  const { expectedOccurrenceRevision, ...commandInput } = operation.command
  const command = planOccurrenceCommandSchema.parse(commandInput)
  if (
    !series ||
    series.id !== command.itemId ||
    series.ownerId !== userId ||
    series.deletedAt ||
    !series.recurrence
  )
    return { status: "unavailable" }
  if (
    !command.occurrenceId.startsWith(`${series.id}:`) ||
    (current &&
      (current.id !== command.occurrenceId || current.seriesId !== series.id))
  )
    return { status: "invalid_command" }
  if (
    operation.baseRevision !== series.revision ||
    (current && current.revision !== expectedOccurrenceRevision)
  )
    return remotePlanOccurrencePlanSchema.parse({
      status: "conflict",
      series,
      current,
    })
  if (
    (!current && expectedOccurrenceRevision !== 0) ||
    current?.cancelled ||
    current?.deletedAt
  )
    return { status: "unavailable" }
  try {
    const record = applyPlanOccurrenceCommand(
      series,
      current,
      command,
      userId,
      timestamp
    )
    return remotePlanOccurrencePlanSchema.parse({
      status: "changes",
      record: { ...record, revision: expectedOccurrenceRevision + 1 },
      expectedSeriesRevision: series.revision,
      expectedOccurrenceRevision,
      currentExists: current !== null,
    })
  } catch {
    return { status: "invalid_command" }
  }
}
