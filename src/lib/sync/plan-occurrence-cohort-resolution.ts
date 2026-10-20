import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import { validatePlanOccurrenceCohortComparison } from "@/lib/sync/plan-occurrence-cohort-comparison"
import { planOccurrenceRetryCommands } from "@/lib/sync/plan-occurrence-retry"
import { planOccurrenceCohortComparisonSchema } from "@/schemas/plan-occurrence-cohort-comparison"
import {
  planOccurrenceCohortResolutionRecordSchema,
  planOccurrenceCohortResolutionRequestSchema,
} from "@/schemas/plan-occurrence-cohort-resolution"
import { remotePlanOccurrenceOperationSchema } from "@/schemas/remote-plan-occurrence-planning"
import type { PlanOccurrenceCohortComparison } from "@/types/plan-occurrence-cohort-comparison"
import type {
  PlanOccurrenceCohortResolutionRecord,
  PlanOccurrenceCohortResolutionRequest,
} from "@/types/plan-occurrence-cohort-resolution"

function retryChains(comparison: PlanOccurrenceCohortComparison) {
  let count = 0
  return comparison.slots.map((slot) => {
    if (!slot.local)
      throw new Error("Appearance cohort retry requires every local draft")
    const commands = planOccurrenceRetryCommands(
      comparison.source.series,
      slot.local,
      slot.remote
    )
    count += commands.length
    if (count > 10000 - comparison.source.entries.length)
      throw new Error(
        "Appearance cohort retry exceeds the complete queue limit"
      )
    if (slot.remote.revision > Number.MAX_SAFE_INTEGER - commands.length)
      throw new Error("Appearance cohort retry exceeds a slot revision range")
    return { slot, commands }
  })
}

export function planOccurrenceCohortRetryOperationCount(
  input: unknown
): number {
  const raw = planOccurrenceCohortComparisonSchema.parse(input)
  const comparison = validatePlanOccurrenceCohortComparison(
    raw,
    raw.source.userId
  )
  return retryChains(comparison).reduce(
    (total, chain) => total + chain.commands.length,
    0
  )
}

// Plans pending replacements only; committing the decision cannot acknowledge any original command.
export function planOccurrenceCohortResolution(
  input: unknown,
  currentInput: unknown
): PlanOccurrenceCohortResolutionRecord {
  const request = planOccurrenceCohortResolutionRequestSchema.parse(input)
  const comparison = validatePlanOccurrenceCohortComparison(
    currentInput,
    request.userId
  )
  if (JSON.stringify(request.expected) !== JSON.stringify(comparison))
    throw new Error("Appearance cohort comparison changed after review")
  const originalIds = new Set(
    comparison.source.entries.map((entry) => entry.operation.operationId)
  )
  const identities = [request.resolutionId, ...request.operationIds]
  if (
    new Set(identities).size !== identities.length ||
    identities.some((id) => originalIds.has(id))
  )
    throw new Error(
      "Appearance cohort decision requires new distinct identities"
    )
  const replacements: PlanOccurrenceCohortResolutionRecord["replacements"] = []
  let locals: PlanOccurrenceCohortResolutionRecord["locals"]
  if (request.choice === "adopt_remote") {
    locals = comparison.slots.map((slot) => ({
      occurrenceId: slot.occurrenceId,
      record: slot.remote,
    }))
  } else {
    const chains = retryChains(comparison)
    if (
      chains.reduce((total, chain) => total + chain.commands.length, 0) !==
      request.operationIds.length
    )
      throw new Error(
        "Appearance cohort retry identities do not match its complete chains"
      )
    locals = chains.map(({ slot, commands }) => {
      let local = slot.remote
      for (const [index, command] of commands.entries()) {
        const operationId = request.operationIds[replacements.length]
        const previous = replacements.at(-1)
        local = applyPlanOccurrenceCommand(
          comparison.source.series,
          local,
          command,
          request.userId,
          request.createdAt
        )
        replacements.push({
          operation: remotePlanOccurrenceOperationSchema.parse({
            operationId,
            protocolVersion: 1,
            baseRevision: comparison.source.series.revision,
            command: {
              ...command,
              expectedOccurrenceRevision: slot.remote.revision + index,
            },
          }),
          dependencies: previous ? [previous.operation.operationId] : [],
        })
      }
      return { occurrenceId: slot.occurrenceId, record: local }
    })
  }
  return planOccurrenceCohortResolutionRecordSchema.parse({
    ...request,
    key: `appearance-cohort-resolution:${request.resolutionId}`,
    locals,
    replacements,
    supersededOperationIds: comparison.operationIds,
  })
}

export function validatePlanOccurrenceCohortResolutionRecord(
  input: unknown,
  actor: string
): PlanOccurrenceCohortResolutionRecord {
  const value = planOccurrenceCohortResolutionRecordSchema.parse(input)
  if (value.userId !== actor)
    throw new Error("Appearance cohort decision belongs to another account")
  const request = {
    userId: value.userId,
    resolutionId: value.resolutionId,
    choice: value.choice,
    operationIds: value.operationIds,
    createdAt: value.createdAt,
    expected: value.expected,
  }
  if (
    JSON.stringify(planOccurrenceCohortResolution(request, value.expected)) !==
    JSON.stringify(value)
  )
    throw new Error(
      "Appearance cohort decision contradicts its preserved evidence"
    )
  return value
}

// Reviewed choices are presentation only; the writer must reread the complete transaction snapshot.
export function availablePlanOccurrenceCohortResolutionChoices(
  input: unknown,
  actor: string
): PlanOccurrenceCohortResolutionRequest["choice"][] {
  let comparison: PlanOccurrenceCohortComparison
  try {
    comparison = validatePlanOccurrenceCohortComparison(input, actor)
  } catch {
    return []
  }
  try {
    retryChains(comparison)
    return ["adopt_remote", "retry_local"]
  } catch {
    return ["adopt_remote"]
  }
}
