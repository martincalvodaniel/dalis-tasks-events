import { applyItemCommand } from "@/lib/calendar/item-command"
import { supportsRemoteItemCommand } from "@/lib/sync/item-command-support"
import { calendarItemDraftSchema } from "@/schemas/calendar-item"
import { syncOperationSchema } from "@/schemas/sync"
import { syncIncidentSnapshotSchema } from "@/schemas/sync-incident"
import {
  syncResolutionRecordSchema,
  syncResolutionRequestSchema,
} from "@/schemas/sync-resolution"
import type { CalendarItem } from "@/types/calendar-item"
import type { SyncOperation } from "@/types/sync"
import type { SyncResolutionRecord } from "@/types/sync-resolution"

function validateResolutionSnapshot(input: unknown, userId: string) {
  const current = syncIncidentSnapshotSchema.parse(input)
  const { entry, local, remote, intentions } = current
  if (
    entry.userId !== userId ||
    entry.state !== "conflict" ||
    current.reason !== "conflict" ||
    !remote
  )
    throw new Error(
      "Resolution requires a preserved conflict with a known remote version"
    )
  if (current.blockedByRelatedIntentions)
    throw new Error(
      "Resolution has related intentions outside its reviewed chain"
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
      (record.ownerId !== userId ||
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
      intention.userId !== userId ||
      intention.entityKey !== entry.entityKey ||
      intention.state === "acknowledged" ||
      intention.state === "sending" ||
      intention.state === "superseded" ||
      (intention.state === "pending" && intention.attempts > 0) ||
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
  return { ...current, remote, ids }
}

export function availableSyncIncidentResolutionChoices(
  input: unknown
): ("adopt_remote" | "retry_local")[] {
  try {
    const parsed = syncIncidentSnapshotSchema.parse(input)
    const { local, remote } = validateResolutionSnapshot(
      parsed,
      parsed.entry.userId
    )
    return local && !remote.deletedAt
      ? ["adopt_remote", "retry_local"]
      : ["adopt_remote"]
  } catch {
    return []
  }
}

export function planSyncIncidentResolution(
  input: unknown,
  currentInput: unknown
): SyncResolutionRecord {
  const request = syncResolutionRequestSchema.parse(input)
  const current = syncIncidentSnapshotSchema.parse(currentInput)
  if (JSON.stringify(request.expected) !== JSON.stringify(current))
    throw new Error("Incident changed since the comparison was opened")
  const { local, remote, intentions, ids } = validateResolutionSnapshot(
    current,
    request.userId
  )
  const identities = [
    request.resolutionId,
    request.operationId,
    request.copyItemId,
  ].filter((id) => id !== null)
  if (
    new Set(identities).size !== identities.length ||
    identities.some((id) => ids.has(id) || id === remote.id)
  )
    throw new Error("Resolution identities must be new and distinct")
  let replacement: SyncOperation | null = null
  let nextLocal = remote
  let copy: CalendarItem | null = null
  if (request.choice !== "adopt_remote") {
    if (
      !local ||
      local.kind === "birthday" ||
      (request.choice === "retry_local" && remote.deletedAt)
    )
      throw new Error(
        "Deleted remote identities cannot be resurrected; recovery requires a new copy"
      )
    if (
      request.choice === "copy_local" &&
      (!remote.deletedAt || local.deletedAt || !request.copyItemId)
    )
      throw new Error(
        "Copy recovery requires a living draft and a deleted remote identity"
      )
    const nextCommand = local.deletedAt
      ? { type: "item.delete" as const, itemId: local.id }
      : {
          type:
            request.choice === "copy_local"
              ? ("item.create" as const)
              : ("item.update" as const),
          itemId: request.copyItemId ?? local.id,
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
      baseRevision: request.choice === "copy_local" ? 0 : remote.revision,
      command: nextCommand,
    })
    const projection = applyItemCommand(
      request.choice === "copy_local" ? null : remote,
      nextCommand,
      request.userId,
      request.createdAt
    )
    if (request.choice === "copy_local") copy = projection
    else nextLocal = projection
  }
  return syncResolutionRecordSchema.parse({
    ...request,
    key: `incident-resolution:${request.resolutionId}`,
    replacement,
    local: nextLocal,
    copy,
    supersededOperationIds: intentions.map(
      (intention) => intention.operation.operationId
    ),
  })
}
