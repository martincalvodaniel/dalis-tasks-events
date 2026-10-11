import {
  decodeRemoteRecurringShadow,
  validateLocalPlanOccurrenceOutcome,
  validateLocalPlanOccurrenceResultInput,
} from "@/lib/sync/local-plan-occurrence-sync"
import { planRemotePlanOccurrenceProjection } from "@/lib/sync/plan-occurrence-projection"
import { planOccurrenceEntityKey } from "@/schemas/local-plan-occurrence-sync"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planOccurrenceResultPlanInputSchema } from "@/schemas/plan-occurrence-projection"
import type { OutboxEntry } from "@/types/local-sync"
import type { PlanOccurrence } from "@/types/plan-occurrence"
import type {
  LocalPlanOccurrenceOutcome,
  RemotePlanOccurrenceShadow,
  RemoteRecurringShadow,
} from "@/types/remote-recurring-sync"

export interface PlanOccurrenceResultPlan {
  status: "applied" | "replayed"
  local: PlanOccurrence | null
  shadows: RemoteRecurringShadow[]
  entries: OutboxEntry[]
  outcome: LocalPlanOccurrenceOutcome
}

// Describes one atomic write. Only a committed local transaction may expose its ACK.
export function planLocalPlanOccurrenceResult(
  input: unknown
): PlanOccurrenceResultPlan {
  const value = planOccurrenceResultPlanInputSchema.parse(input)
  const { userId } = value
  const { operation, result, senderId } =
    validateLocalPlanOccurrenceResultInput(value.submission, userId)
  const command = operation.command
  const entityKey = planOccurrenceEntityKey(command.occurrenceId)
  const shadows = new Map<string, RemoteRecurringShadow>()
  for (const raw of value.shadows) {
    const shadow = decodeRemoteRecurringShadow(raw, userId)
    if (shadows.has(shadow.entityKey))
      throw new Error("Duplicate stored recurring shadow identity")
    shadows.set(shadow.entityKey, shadow)
  }
  const previousShadow = shadows.get(entityKey)
  if (previousShadow && previousShadow.kind !== "plan-occurrence")
    throw new Error("Stored appearance shadow has an incompatible kind")
  const projectionInput = {
    userId,
    key: { seriesId: command.itemId, id: command.occurrenceId },
    series: value.series,
    local: value.local,
    shadow: previousShadow ?? null,
    incoming: null,
    entries: value.entries,
  }
  planRemotePlanOccurrenceProjection(projectionInput)
  const entry = value.entries.find(
    (candidate) => candidate.operation.operationId === operation.operationId
  )
  if (!entry || JSON.stringify(entry.operation) !== JSON.stringify(operation))
    throw new Error("Submitted appearance intention changed before its result")
  const previous =
    value.existingOutcome === null
      ? null
      : validateLocalPlanOccurrenceOutcome(value.existingOutcome, userId)
  if (entry.state === "acknowledged") {
    if (
      !previous ||
      JSON.stringify(previous.operation) !== JSON.stringify(operation) ||
      JSON.stringify(previous.result) !== JSON.stringify(result)
    )
      throw new Error(
        "Acknowledged appearance result differs from its durable outcome"
      )
    return {
      status: "replayed",
      local: value.local,
      shadows: value.shadows,
      entries: value.entries,
      outcome: previous,
    }
  }
  if (entry.state !== "sending" || entry.lease?.ownerId !== senderId)
    throw new Error("Sync sender no longer owns the appearance operation lease")
  const current = result.outcome
  const outcome = validateLocalPlanOccurrenceOutcome(
    {
      version: 2,
      kind: "plan-occurrence",
      key: `operation-outcome:${operation.operationId}`,
      operation,
      result,
      local: value.local,
      base: previousShadow?.record ?? null,
      series: value.series,
    },
    userId
  )
  const state =
    current.status === "applied"
      ? "acknowledged"
      : current.status === "conflict"
        ? "conflict"
        : current.status === "unsupported"
          ? "pending"
          : "rejected"
  const entries = value.entries.map((candidate) => {
    if (candidate.operation.operationId === operation.operationId)
      return outboxEntrySchema.parse({ ...candidate, state, lease: null })
    const next = candidate.operation.command
    if (
      current.status === "applied" &&
      candidate.state === "pending" &&
      candidate.attempts === 0 &&
      candidate.dependencies.includes(operation.operationId) &&
      "expectedOccurrenceRevision" in next &&
      next.expectedOccurrenceRevision !== undefined &&
      "occurrenceId" in next &&
      next.occurrenceId === command.occurrenceId &&
      "itemId" in next &&
      next.itemId === command.itemId
    )
      return outboxEntrySchema.parse({
        ...candidate,
        operation: {
          ...candidate.operation,
          command: {
            ...next,
            expectedOccurrenceRevision: current.occurrence.revision,
          },
        },
      })
    return candidate
  })
  let incoming: RemotePlanOccurrenceShadow | null = null
  const record =
    current.status === "applied"
      ? current.occurrence
      : current.status === "conflict"
        ? current.current
        : null
  if (record)
    incoming = {
      version: 2,
      kind: "plan-occurrence",
      userId,
      entityKey,
      record,
      seriesRevision:
        current.status === "applied"
          ? current.seriesRevision
          : current.status === "conflict"
            ? current.series.revision
            : 0,
    }
  const projected = planRemotePlanOccurrenceProjection({
    ...projectionInput,
    entries,
    incoming,
  })
  if (projected.shadow) shadows.set(entityKey, projected.shadow)
  if (shadows.size > 10000)
    throw new Error("Appearance result exceeds the complete shadow limit")
  return {
    status: "applied",
    local: projected.local,
    shadows: [...shadows.values()],
    entries,
    outcome,
  }
}
