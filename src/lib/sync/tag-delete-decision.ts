import { planRemoteTagOperation } from "@/lib/preferences/remote-tag-plan"
import { validateTagDeletionResolutionSnapshot } from "@/lib/sync/tag-delete-resolution"
import { syncOperationSchema } from "@/schemas/sync"
import {
  tagDeletionResolutionRecordSchema,
  tagDeletionResolutionRequestSchema,
} from "@/schemas/tag-delete-resolution"
import type { TagCatalogResolutionSnapshot } from "@/types/tag-catalog-resolution"
import type {
  TagDeletionResolutionRecord,
  TagDeletionResolutionRequest,
} from "@/types/tag-delete-resolution"

function previewDeletion(
  snapshot: TagCatalogResolutionSnapshot,
  operationId: string,
  timestamp: string
) {
  const command = snapshot.incident.entry.operation.command
  if (command.type !== "tag.delete")
    throw new Error("Category deletion requires its exact original command")
  const primary = snapshot.observedTags.find((tag) => tag.id === command.tagId)
  if (!primary || primary.deletedAt)
    throw new Error(
      "Category deletion retry requires a living observed primary"
    )
  const replacement = syncOperationSchema.parse({
      operationId,
      protocolVersion: 1,
      baseRevision: primary.revision,
      command,
    }),
    planned = planRemoteTagOperation({
      userId: snapshot.incident.entry.userId,
      timestamp,
      operation: replacement,
      tags: snapshot.observedTags,
    })
  if (
    planned.status !== "changes" ||
    planned.effects.length !== 1 ||
    planned.effects[0].store !== "tags" ||
    planned.effects[0].record.id !== primary.id
  )
    throw new Error("Category deletion has no exact supported preview")
  const effect = planned.effects[0].record
  // A local deletion preview remains unconfirmed and retains the observed revision.
  return {
    replacement,
    tags: snapshot.observedTags.map((tag) =>
      tag.id === primary.id ? { ...effect, revision: tag.revision } : tag
    ),
  }
}
export function availableTagDeletionResolutionChoices(
  input: unknown,
  actor: string
): TagDeletionResolutionRequest["choice"][] {
  try {
    const snapshot = validateTagDeletionResolutionSnapshot(input, actor)
    try {
      previewDeletion(
        snapshot,
        snapshot.incident.entry.operation.operationId,
        snapshot.incident.entry.createdAt
      )
      return ["adopt_remote", "retry_delete"]
    } catch {
      return ["adopt_remote"]
    }
  } catch {
    return []
  }
}
export function planTagDeletionIncidentResolution(
  input: unknown,
  currentInput: unknown
): TagDeletionResolutionRecord {
  const request = tagDeletionResolutionRequestSchema.parse(input),
    current = validateTagDeletionResolutionSnapshot(
      currentInput,
      request.userId
    )
  if (JSON.stringify(request.expected) !== JSON.stringify(current))
    throw new Error("Category deletion comparison changed after it was opened")
  if (
    request.resolutionId === request.operationId ||
    [...current.incident.intentions, ...current.acknowledgedDependencies].some(
      (entry) =>
        entry.operation.operationId === request.resolutionId ||
        entry.operation.operationId === request.operationId
    )
  )
    throw new Error(
      "Category deletion decision identities must be new and distinct"
    )
  const preview =
    request.choice === "retry_delete" && request.operationId
      ? previewDeletion(current, request.operationId, request.createdAt)
      : { replacement: null, tags: current.observedTags }
  return tagDeletionResolutionRecordSchema.parse({
    ...request,
    key: `tag-delete-resolution:${request.resolutionId}`,
    ...preview,
    supersededOperationIds: [current.incident.entry.operation.operationId],
  })
}
export function validateTagDeletionResolutionRecord(
  input: unknown,
  actor: string
): TagDeletionResolutionRecord {
  const record = tagDeletionResolutionRecordSchema.parse(input)
  if (record.userId !== actor)
    throw new Error("Category deletion decision belongs to another account")
  const planned = planTagDeletionIncidentResolution(
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
  if (JSON.stringify(record) !== JSON.stringify(planned))
    throw new Error(
      "Stored category deletion decision contradicts its reviewed evidence"
    )
  return record
}
