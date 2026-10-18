import { planRemoteTagOperation } from "@/lib/preferences/remote-tag-plan"
import { validateTagOrderResolutionSnapshot } from "@/lib/sync/tag-order-resolution"
import { syncOperationSchema } from "@/schemas/sync"
import {
  tagOrderResolutionRecordSchema,
  tagOrderResolutionRequestSchema,
} from "@/schemas/tag-order-resolution"
import type {
  TagOrderResolutionRecord,
  TagOrderResolutionRequest,
  TagOrderResolutionSnapshot,
} from "@/types/tag-order-resolution"

function previewLatestMove(
  snapshot: TagOrderResolutionSnapshot,
  operationId: string,
  timestamp: string
) {
  const latest = snapshot.incident.intentions.at(-1)
  if (latest?.operation.command.type !== "tag.move")
    throw new Error("Category order has no reviewed latest move")
  const command = latest.operation.command
  const primary = snapshot.observedTags.find((tag) => tag.id === command.tagId)
  if (!primary || primary.deletedAt)
    throw new Error("Category order retry requires a living observed primary")
  const replacement = syncOperationSchema.parse({
    operationId,
    protocolVersion: 1,
    baseRevision: primary.revision,
    command: latest.operation.command,
  })
  const planned = planRemoteTagOperation({
    userId: snapshot.incident.entry.userId,
    timestamp,
    operation: replacement,
    tags: snapshot.observedTags,
  })
  if (planned.status !== "changes")
    throw new Error(
      "Category order latest move cannot be reapplied to the reviewed catalog"
    )
  const changed = new Map(
    planned.effects.map((effect) => {
      if (effect.store !== "tags")
        throw new Error("Category order preview contains another preference")
      return [effect.record.id, effect.record] as const
    })
  )
  // Preview effects are not ACKs: optimistic records keep each observed revision.
  const tags = snapshot.observedTags.map((tag) => {
    const effect = changed.get(tag.id)
    return effect ? { ...effect, revision: tag.revision } : tag
  })
  return { replacement, tags }
}

// Presentation only; the writer must recapture evidence and prove prerequisite ACKs.
export function availableTagOrderResolutionChoices(
  input: unknown,
  actor: string
): TagOrderResolutionRequest["choice"][] {
  try {
    const snapshot = validateTagOrderResolutionSnapshot(input, actor)
    try {
      // The existing ID is used only for pure rank/size validation, never written or acknowledged.
      previewLatestMove(
        snapshot,
        snapshot.incident.entry.operation.operationId,
        snapshot.incident.entry.createdAt
      )
      return ["adopt_remote", "retry_latest_move"]
    } catch {
      return ["adopt_remote"]
    }
  } catch {
    return []
  }
}

export function planTagOrderIncidentResolution(
  input: unknown,
  currentInput: unknown
): TagOrderResolutionRecord {
  const request = tagOrderResolutionRequestSchema.parse(input),
    current = validateTagOrderResolutionSnapshot(currentInput, request.userId)
  if (JSON.stringify(request.expected) !== JSON.stringify(current))
    throw new Error("Category order comparison changed after it was opened")
  const originals = [
    ...current.incident.intentions,
    ...current.acknowledgedDependencies,
  ]
  if (
    request.resolutionId === request.operationId ||
    originals.some(
      (entry) =>
        entry.operation.operationId === request.resolutionId ||
        entry.operation.operationId === request.operationId
    )
  )
    throw new Error(
      "Category order decision identities must be new and distinct"
    )
  const latest = current.incident.intentions.at(-1)
  if (!latest)
    throw new Error("Category order requires its latest reviewed intention")
  const preview =
    request.choice === "retry_latest_move" && request.operationId
      ? previewLatestMove(current, request.operationId, request.createdAt)
      : { replacement: null, tags: current.observedTags }
  return tagOrderResolutionRecordSchema.parse({
    ...request,
    key: `tag-order-resolution:${request.resolutionId}`,
    ...preview,
    supersededOperationIds: current.incident.intentions.map(
      (entry) => entry.operation.operationId
    ),
    latestMoveOperationId: latest.operation.operationId,
  })
}

export function validateTagOrderResolutionRecord(
  input: unknown,
  actor: string
): TagOrderResolutionRecord {
  const record = tagOrderResolutionRecordSchema.parse(input)
  if (record.userId !== actor)
    throw new Error("Category order decision belongs to another account")
  const planned = planTagOrderIncidentResolution(
    {
      userId: record.userId,
      resolutionId: record.resolutionId,
      operationId: record.operationId,
      choice: record.choice,
      createdAt: record.createdAt,
      expected: record.expected,
    },
    record.expected
  )
  if (JSON.stringify(planned) !== JSON.stringify(record))
    throw new Error(
      "Stored category order decision contradicts its reviewed evidence"
    )
  return record
}
