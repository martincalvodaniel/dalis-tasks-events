import { applyItemViewCommand } from "@/lib/preferences/preference-command"
import {
  availableSyncIncidentResolutionChoices,
  planSyncIncidentResolution,
} from "@/lib/sync/incident-resolution"
import { readPlanCategoryRecoveryChain } from "@/lib/sync/plan-category-recovery-chain"
import {
  planCategoryResolutionCaptureSchema,
  planCategoryResolutionRecordSchema,
  planCategoryResolutionRequestSchema,
  planCategoryResolutionSnapshotSchema,
} from "@/schemas/plan-category-resolution"
import type {
  PlanCategoryResolutionRecord,
  PlanCategoryResolutionRequest,
  PlanCategoryResolutionSnapshot,
} from "@/types/plan-category-resolution"

// Callers must reconstruct this capture inside their transaction; a DTO is not authorization.
export function capturePlanCategoryResolutionSnapshot(
  input: unknown
): PlanCategoryResolutionSnapshot {
  const value = planCategoryResolutionCaptureSchema.parse(input)
  const chain = readPlanCategoryRecoveryChain({
    userId: value.userId,
    incident: value.incident,
    entries: value.entries,
  })
  const ids = new Set(
    chain.intentions.map((entry) => entry.operation.operationId)
  )
  const dependencies = new Set(
    chain.intentions.flatMap((entry) =>
      entry.dependencies.filter((id) => !ids.has(id))
    )
  )
  return validateSnapshot(
    {
      incident: chain.incident,
      viewIntentions: chain.views,
      acknowledgedDependencies: value.entries
        .filter((entry) => dependencies.has(entry.operation.operationId))
        .toSorted((a, b) => a.sequence - b.sequence),
      localView: value.localView,
      remoteView: value.remoteView,
      localTag: value.localTag,
    },
    value.userId
  )
}
function validateSnapshot(
  input: unknown,
  actor: string
): PlanCategoryResolutionSnapshot {
  const value = planCategoryResolutionSnapshotSchema.parse(input)
  const { incident, localView, remoteView, localTag } = value
  const local = incident.local,
    remote = incident.remote
  if (
    incident.entry.userId !== actor ||
    !local ||
    !remote ||
    local.kind !== "plan" ||
    remote.kind !== "plan" ||
    local.recurrence ||
    remote.recurrence ||
    local.deletedAt ||
    remote.deletedAt ||
    !availableSyncIncidentResolutionChoices(incident, true).includes(
      "retry_local"
    )
  )
    throw new Error(
      "Joint comparison requires its own supported living simple conflict"
    )
  for (const view of [localView, remoteView])
    if (view.userId !== actor || view.itemId !== local.id || view.deletedAt)
      throw new Error(
        "Joint view belongs to another account, plan or deleted identity"
      )
  if (remoteView.revision < 1)
    throw new Error("Joint recovery requires an observed committed remote view")
  if (
    localTag &&
    (localTag.userId !== actor || localTag.id !== localView.primaryTagId)
  )
    throw new Error("Joint category belongs to another account or assignment")
  const all = [
    ...incident.intentions,
    ...value.viewIntentions,
    ...value.acknowledgedDependencies,
  ]
  const byId = new Map(all.map((entry) => [entry.operation.operationId, entry]))
  if (
    all.length > 10000 ||
    byId.size !== all.length ||
    new Set(all.map((entry) => entry.sequence)).size !== all.length ||
    all.some((entry) => entry.userId !== actor)
  )
    throw new Error("Joint comparison contains foreign or duplicate intentions")
  const ids = new Set(
    [...incident.intentions, ...value.viewIntentions].map(
      (entry) => entry.operation.operationId
    )
  )
  if (
    value.acknowledgedDependencies.some(
      (entry) => entry.state !== "acknowledged"
    )
  )
    throw new Error(
      "Joint prerequisites require preserved ACKs, never local supersession"
    )
  const referenced = new Set<string>()
  for (const entry of [...incident.intentions, ...value.viewIntentions])
    for (const id of entry.dependencies) {
      const parent = byId.get(id)
      if (
        !parent ||
        parent.sequence >= entry.sequence ||
        (!ids.has(id) && parent.state !== "acknowledged")
      )
        throw new Error(
          "Joint comparison has an incomplete or unconfirmed prerequisite"
        )
      if (!ids.has(id)) referenced.add(id)
    }
  if (
    value.acknowledgedDependencies.some(
      (entry) => !referenced.has(entry.operation.operationId)
    )
  )
    throw new Error("Joint comparison contains an unreviewed prerequisite")
  if (
    value.viewIntentions.some(
      (entry, index) =>
        index > 0 && entry.sequence <= value.viewIntentions[index - 1].sequence
    )
  )
    throw new Error(
      "Joint assignments must preserve their original sequence order"
    )
  const connected = new Set(
    incident.intentions.map((entry) => entry.operation.operationId)
  )
  for (const entry of value.viewIntentions) {
    const command = entry.operation.command
    if (
      entry.entityKey !== `item-view:${local.id}` ||
      command.type !== "item-view.set" ||
      command.itemId !== local.id ||
      entry.state !== "pending" ||
      entry.attempts !== 0 ||
      !entry.dependencies.some((id) => connected.has(id))
    )
      throw new Error(
        "Joint comparison contains an uncertain or disconnected assignment"
      )
    connected.add(entry.operation.operationId)
  }
  const latest = value.viewIntentions.at(-1)?.operation.command
  if (
    latest?.type !== "item-view.set" ||
    latest.primaryTagId !== localView.primaryTagId
  )
    throw new Error(
      "Joint local assignment does not match its latest intention"
    )
  return value
}
function canRetry(value: PlanCategoryResolutionSnapshot) {
  return (
    value.remoteView.revision < Number.MAX_SAFE_INTEGER &&
    (value.incident.remote?.revision ?? Number.MAX_SAFE_INTEGER) <
      Number.MAX_SAFE_INTEGER &&
    (value.localView.primaryTagId === null ||
      (value.localTag !== null &&
        !value.localTag.deletedAt &&
        value.localTag.revision > 0))
  )
}

// Reviewed options are presentation only; writes must reconstruct the complete transaction capture.
export function availableReviewedPlanCategoryResolutionChoices(
  input: unknown,
  actor: string
): PlanCategoryResolutionRequest["choice"][] {
  try {
    const value = validateSnapshot(input, actor)
    return canRetry(value) ? ["adopt_remote", "retry_local"] : ["adopt_remote"]
  } catch {
    return []
  }
}
export function availablePlanCategoryResolutionChoices(
  input: unknown
): PlanCategoryResolutionRequest["choice"][] {
  try {
    const value = capturePlanCategoryResolutionSnapshot(input)
    return canRetry(value) ? ["adopt_remote", "retry_local"] : ["adopt_remote"]
  } catch {
    return []
  }
}
function planReviewedChoice(
  request: PlanCategoryResolutionRequest
): PlanCategoryResolutionRecord {
  const expected = validateSnapshot(request.expected, request.userId)
  const identities = [
    request.resolutionId,
    request.operationId,
    request.viewOperationId,
  ].filter((id) => id !== null)
  const intentions = [
    ...expected.incident.intentions,
    ...expected.viewIntentions,
  ].toSorted((a, b) => a.sequence - b.sequence)
  const oldIds = new Set(
    [...intentions, ...expected.acknowledgedDependencies].map(
      (entry) => entry.operation.operationId
    )
  )
  if (
    new Set(identities).size !== identities.length ||
    identities.some((id) => oldIds.has(id) || id === expected.localView.itemId)
  )
    throw new Error("Joint decision identities must be new and distinct")
  if (request.choice === "retry_local" && !canRetry(expected))
    throw new Error(
      "Joint retry requires its own living committed category and usable revisions"
    )
  const root = planSyncIncidentResolution(
    {
      userId: request.userId,
      resolutionId: request.resolutionId,
      operationId: request.operationId,
      choice: request.choice,
      createdAt: request.createdAt,
      expected: expected.incident,
    },
    expected.incident,
    true
  )
  const viewReplacement =
    request.choice === "retry_local"
      ? {
          operationId: request.viewOperationId,
          protocolVersion: 1 as const,
          baseRevision: expected.remoteView.revision,
          command: {
            type: "item-view.set" as const,
            itemId: expected.localView.itemId,
            primaryTagId: expected.localView.primaryTagId,
          },
        }
      : null
  const view = viewReplacement
    ? applyItemViewCommand(
        expected.remoteView,
        root.local,
        expected.localTag,
        viewReplacement.command,
        request.userId,
        request.createdAt
      )
    : expected.remoteView
  return planCategoryResolutionRecordSchema.parse({
    ...request,
    key: `plan-category-resolution:${request.resolutionId}`,
    local: root.local,
    view,
    replacement: root.replacement,
    viewReplacement,
    supersededOperationIds: intentions.map(
      (entry) => entry.operation.operationId
    ),
  })
}
export function planPlanCategoryIncidentResolution(
  input: unknown,
  currentInput: unknown
): PlanCategoryResolutionRecord {
  const request = planCategoryResolutionRequestSchema.parse(input)
  const raw = planCategoryResolutionCaptureSchema.parse(currentInput)
  const current = capturePlanCategoryResolutionSnapshot(raw)
  const priorIds = new Set(
    raw.entries.map((entry) => entry.operation.operationId)
  )
  if (
    [request.resolutionId, request.operationId, request.viewOperationId].some(
      (id) => id !== null && priorIds.has(id)
    )
  )
    throw new Error("Joint decision identity is already in use")
  if (JSON.stringify(request.expected) !== JSON.stringify(current))
    throw new Error("Joint comparison changed after it was opened")
  return planReviewedChoice(request)
}
export function validatePlanCategoryResolutionRecord(
  input: unknown,
  actor: string
): PlanCategoryResolutionRecord {
  const record = planCategoryResolutionRecordSchema.parse(input)
  if (record.userId !== actor)
    throw new Error("Joint decision belongs to another account")
  const request = {
    userId: record.userId,
    resolutionId: record.resolutionId,
    operationId: record.operationId,
    viewOperationId: record.viewOperationId,
    choice: record.choice,
    createdAt: record.createdAt,
    expected: record.expected,
  }
  if (JSON.stringify(planReviewedChoice(request)) !== JSON.stringify(record))
    throw new Error("Stored joint decision contradicts its reviewed evidence")
  return record
}
