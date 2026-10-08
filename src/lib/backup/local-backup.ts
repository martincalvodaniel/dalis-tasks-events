import { assertBackupOwnership } from "@/lib/backup/backup-ownership"
import { validateBackupImportEvidence } from "@/lib/backup/import-record"
import { localBackupSchema } from "@/schemas/local-backup"
import { userIdSchema } from "@/schemas/primitives"
import type { LocalBackup } from "@/types/local-backup"

export const maximumBackupBytes = 16 * 1024 * 1024
export const localBackupStoreNames = [
  "items",
  "occurrences",
  "tags",
  "itemViews",
  "taskPlacements",
  "settings",
  "memberships",
  "invitations",
  "outbox",
  "remoteShadows",
  "syncMetadata",
] as const

function unique(keys: (string | number)[], description: string): void {
  if (new Set(keys).size !== keys.length)
    throw new Error(`Backup has duplicate ${description}`)
}

export function validateLocalBackup(
  input: unknown,
  expectedUserId: string
): LocalBackup {
  const actor = userIdSchema.parse(expectedUserId)
  const backup = localBackupSchema.parse(input)
  if (backup.userId !== actor)
    throw new Error("Backup belongs to another account")
  assertBackupOwnership(backup.stores, actor)
  const s = backup.stores
  for (const records of [s.items, s.occurrences, s.tags, s.invitations])
    unique(
      records.map((record) => record.id),
      "record IDs"
    )
  unique(
    s.itemViews.map((record) => record.itemId),
    "item views"
  )
  unique(
    s.taskPlacements.map((record) =>
      JSON.stringify([record.occurrenceId, record.scope, record.date])
    ),
    "placements"
  )
  unique(
    s.settings.map((record) => record.userId),
    "settings"
  )
  unique(
    s.memberships.map((record) =>
      JSON.stringify([record.itemId, record.userId])
    ),
    "memberships"
  )
  unique(
    s.remoteShadows.map((record) => record.entityKey),
    "shadows"
  )
  unique(
    s.syncMetadata.map((record) => record.key),
    "metadata keys"
  )
  unique(
    s.outbox.map((record) => record.operation.operationId),
    "operation IDs"
  )
  unique(
    s.outbox.map((record) => record.sequence),
    "operation sequences"
  )
  const entries = new Map(
    s.outbox.map((entry) => [entry.operation.operationId, entry])
  )
  for (const entry of s.outbox)
    for (const dependency of entry.dependencies) {
      const parent = entries.get(dependency)
      if (!parent || parent.sequence >= entry.sequence)
        throw new Error("Backup has missing or unordered dependencies")
    }
  const sequence = s.syncMetadata.find(
    (record) => record.key === "outbox-sequence"
  )
  if (
    s.outbox.length &&
    (!sequence ||
      !("value" in sequence) ||
      s.outbox.some((entry) => entry.sequence > sequence.value))
  )
    throw new Error("Backup sequence is behind its durable queue")
  const outcomes = new Map(
    s.syncMetadata
      .filter((record) => "result" in record)
      .map((record) => [record.operation.operationId, record])
  )
  const superseded = new Set<string>()
  for (const record of s.syncMetadata) {
    if ("importId" in record)
      validateBackupImportEvidence(record, entries, actor)
    if ("result" in record) {
      const entry = entries.get(record.operation.operationId)
      if (
        !entry ||
        JSON.stringify(entry.operation) !== JSON.stringify(record.operation)
      )
        throw new Error("Backup outcome does not match its preserved operation")
      const command = record.operation.command
      const resultItem =
        record.result.status === "applied"
          ? record.result.item
          : record.result.status === "conflict"
            ? record.result.current
            : null
      if (
        "itemId" in command &&
        [record.local, record.base, resultItem].some(
          (item) => item !== null && item.id !== command.itemId
        )
      )
        throw new Error("Backup outcome belongs to another item")
    }
    if ("resolutionId" in record) {
      for (const id of record.supersededOperationIds) {
        const entry = entries.get(id)
        const reviewed = record.expected.intentions.find(
          (intention) => intention.operation.operationId === id
        )
        if (
          entry?.state !== "superseded" ||
          !reviewed ||
          JSON.stringify(entry.operation) !== JSON.stringify(reviewed.operation)
        )
          throw new Error(
            "Backup decision is missing its superseded intentions"
          )
        const preservedOutcome = outcomes.get(id)?.result.status
        if (
          (reviewed.state === "conflict" && preservedOutcome !== "conflict") ||
          (reviewed.state === "rejected" &&
            (!preservedOutcome ||
              !["unavailable", "invalid_command", "identity_reuse"].includes(
                preservedOutcome
              )))
        )
          throw new Error("Backup decision is missing its original outcome")
        superseded.add(id)
      }
      if (
        record.replacement &&
        JSON.stringify(
          entries.get(record.replacement.operationId)?.operation
        ) !== JSON.stringify(record.replacement)
      )
        throw new Error("Backup decision is missing its exact replacement")
    }
    if (
      "operationId" in record &&
      record.key === "preference-tail" &&
      record.operationId !== null &&
      !entries.has(record.operationId)
    )
      throw new Error("Backup preference tail is missing")
  }
  for (const entry of s.outbox) {
    const outcome = outcomes.get(entry.operation.operationId)
    if (
      (entry.state === "acknowledged" &&
        outcome?.result.status !== "applied") ||
      (entry.state === "conflict" && outcome?.result.status !== "conflict") ||
      (entry.state === "rejected" &&
        (!outcome ||
          !["unavailable", "invalid_command", "identity_reuse"].includes(
            outcome.result.status
          ))) ||
      (entry.state === "superseded" &&
        !superseded.has(entry.operation.operationId))
    )
      throw new Error("Backup is missing durable operation evidence")
  }
  return backup
}

export function encodeLocalBackup(input: unknown, userId: string): string {
  const json = JSON.stringify(validateLocalBackup(input, userId))
  if (new TextEncoder().encode(json).byteLength > maximumBackupBytes)
    throw new Error("Backup exceeds its size limit")
  return json
}
export function decodeLocalBackup(json: string, userId: string): LocalBackup {
  if (new TextEncoder().encode(json).byteLength > maximumBackupBytes)
    throw new Error("Backup exceeds its size limit")
  return validateLocalBackup(JSON.parse(json), userId)
}
