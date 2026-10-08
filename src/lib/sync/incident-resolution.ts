import { applyItemCommand } from "@/lib/calendar/item-command"
import { supportsRemoteItemCommand } from "@/lib/sync/item-command-support"
import { calendarItemDraftSchema } from "@/schemas/calendar-item"
import { syncOperationSchema } from "@/schemas/sync"
import { syncIncidentSnapshotSchema } from "@/schemas/sync-incident"
import {
  syncResolutionRecordSchema,
  syncResolutionRequestSchema,
} from "@/schemas/sync-resolution"
import type { SyncOperation } from "@/types/sync"
import type { SyncResolutionRecord } from "@/types/sync-resolution"

export function planSyncIncidentResolution(
  input: unknown,
  currentInput: unknown
): SyncResolutionRecord {
  const request = syncResolutionRequestSchema.parse(input)
  const current = syncIncidentSnapshotSchema.parse(currentInput)
  if (JSON.stringify(request.expected) !== JSON.stringify(current))
    throw new Error("Incident changed since the comparison was opened")
  const { entry, local, remote, intentions } = current
  if (
    entry.userId !== request.userId ||
    entry.state !== "conflict" ||
    current.reason !== "conflict" ||
    !remote
  )
    throw new Error(
      "Resolution requires a preserved conflict with a known remote version"
    )
  const command = entry.operation.command
  if (!("itemId" in command) || entry.entityKey !== `item:${command.itemId}`)
    throw new Error("Resolution requires an item identity")
  for (const record of [
    local,
    remote,
    current.localAtOutcome,
    current.shadowAtOutcome,
  ]) {
    if (
      record &&
      (record.ownerId !== request.userId ||
        record.id !== command.itemId ||
        record.kind === "birthday" ||
        record.recurrence)
    )
      throw new Error("Resolution record is foreign or unsupported")
  }
  if (remote.revision < 1 || (local && local.kind !== remote.kind))
    throw new Error(
      "Resolution requires a committed remote version of the same kind"
    )
  const ids = new Set<string>()
  const sequences = new Set<number>()
  for (const intention of intentions) {
    if (
      intention.userId !== request.userId ||
      intention.entityKey !== entry.entityKey ||
      intention.state === "acknowledged" ||
      intention.state === "sending" ||
      ids.has(intention.operation.operationId) ||
      sequences.has(intention.sequence) ||
      !supportsRemoteItemCommand(intention.operation.command, local ?? remote)
    )
      throw new Error(
        "Resolution must preserve a complete supported chain without active sends"
      )
    ids.add(intention.operation.operationId)
    sequences.add(intention.sequence)
  }
  if (
    !intentions.some(
      (candidate) => JSON.stringify(candidate) === JSON.stringify(entry)
    )
  )
    throw new Error("Resolution chain is missing its incident")
  if (
    ids.has(request.resolutionId) ||
    (request.operationId &&
      (ids.has(request.operationId) ||
        request.operationId === request.resolutionId))
  )
    throw new Error("Resolution identities must be new and distinct")
  let replacement: SyncOperation | null = null
  let nextLocal = remote
  if (request.choice === "retry_local") {
    if (!local || local.kind === "birthday" || remote.deletedAt)
      throw new Error(
        "Deleted remote identities cannot be resurrected; recovery requires a new copy"
      )
    const nextCommand = local.deletedAt
      ? { type: "item.delete" as const, itemId: local.id }
      : {
          type: "item.update" as const,
          itemId: local.id,
          input: calendarItemDraftSchema.parse(
            local.kind === "task"
              ? {
                  kind: local.kind,
                  title: local.title,
                  description: local.description,
                  scheduledDate: local.scheduledDate,
                  status: local.status,
                  checklist: local.checklist,
                  recurrence: local.recurrence,
                }
              : {
                  kind: local.kind,
                  title: local.title,
                  description: local.description,
                  schedule: local.schedule,
                  recurrence: local.recurrence,
                }
          ),
        }
    replacement = syncOperationSchema.parse({
      protocolVersion: 1,
      operationId: request.operationId,
      baseRevision: remote.revision,
      command: nextCommand,
    })
    nextLocal = applyItemCommand(
      remote,
      nextCommand,
      request.userId,
      request.createdAt
    )
  }
  return syncResolutionRecordSchema.parse({
    ...request,
    key: `incident-resolution:${request.resolutionId}`,
    replacement,
    local: nextLocal,
    supersededOperationIds: intentions.map(
      (intention) => intention.operation.operationId
    ),
  })
}
