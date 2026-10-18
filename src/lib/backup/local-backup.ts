import { assertBackupOwnership } from "@/lib/backup/backup-ownership"
import { validateBackupImportEvidence } from "@/lib/backup/import-record"
import { decodeLocalOperationOutcome } from "@/lib/sync/local-operation-outcome-v2"
import { decodeRemoteRecurringShadow } from "@/lib/sync/local-plan-occurrence-sync"
import { decodeLocalRecurringOutcome } from "@/lib/sync/local-recurring-outcome"
import { validatePlanOccurrenceResolutionRecord } from "@/lib/sync/plan-occurrence-resolution"
import { projectPlanOccurrenceSyncIncidents } from "@/lib/sync/recurring-incident-snapshot"
import { decodeRemoteShadow } from "@/lib/sync/remote-shadow-v2"
import { validateSettingsResolutionRecord } from "@/lib/sync/settings-resolution"
import { validateTagResolutionRecord } from "@/lib/sync/tag-resolution"
import { localBackupSchema } from "@/schemas/local-backup"
import { planOccurrenceEntityKey } from "@/schemas/local-plan-occurrence-sync"
import { localRecurringBackupSchema } from "@/schemas/local-recurring-backup"
import { userIdSchema } from "@/schemas/primitives"
import type { LocalBackup, LocalRecurringBackup } from "@/types/local-backup"

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
  return validateBackup(input, expectedUserId, false)
}

export function validateLocalRecurringBackup(
  input: unknown,
  expectedUserId: string
): LocalRecurringBackup {
  return validateBackup(input, expectedUserId, true)
}

function validateBackup(
  input: unknown,
  expectedUserId: string,
  recurring: false
): LocalBackup
function validateBackup(
  input: unknown,
  expectedUserId: string,
  recurring: true
): LocalRecurringBackup
function validateBackup(
  input: unknown,
  expectedUserId: string,
  recurring: boolean
): LocalRecurringBackup {
  const actor = userIdSchema.parse(expectedUserId)
  const backup = recurring
    ? localRecurringBackupSchema.parse(input)
    : localBackupSchema.parse(input)
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
  for (const shadow of s.remoteShadows)
    if (recurring) decodeRemoteRecurringShadow(shadow, actor)
    else decodeRemoteShadow(shadow, actor)
  if (recurring) {
    projectPlanOccurrenceSyncIncidents({
      userId: actor,
      items: s.items,
      occurrences: s.occurrences,
      entries: s.outbox,
      shadows: s.remoteShadows,
      outcomes: s.syncMetadata.filter((record) => "result" in record),
    })
    const shadows = new Map(
      s.remoteShadows.map((raw) => {
        const shadow = decodeRemoteRecurringShadow(raw, actor)
        return [shadow.entityKey, shadow] as const
      })
    )
    for (const raw of s.syncMetadata) {
      if (!("result" in raw)) continue
      const outcome = decodeLocalRecurringOutcome(raw, actor)
      if (outcome.kind !== "plan-occurrence") continue
      const shadow = shadows.get(
        planOccurrenceEntityKey(outcome.operation.command.occurrenceId)
      )
      if (shadow && shadow.kind !== "plan-occurrence")
        throw new Error("Backup appearance shadow has another family")
      const result = outcome.result.outcome
      const known = [
        outcome.base,
        result.status === "applied"
          ? result.occurrence
          : result.status === "conflict"
            ? result.current
            : null,
        shadow?.record ?? null,
      ]
      for (const first of known)
        for (const second of known)
          if (
            first &&
            second &&
            first.revision === second.revision &&
            JSON.stringify(first) !== JSON.stringify(second)
          )
            throw new Error(
              "Backup appearance remote versions are contradictory"
            )
      if (
        shadow &&
        known.some(
          (record) => record && record.revision > shadow.record.revision
        )
      )
        throw new Error("Backup appearance shadow regresses durable evidence")
    }
  }
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
    s.syncMetadata.flatMap((record) =>
      "result" in record
        ? [
            [
              record.operation.operationId,
              recurring
                ? decodeLocalRecurringOutcome(record, actor)
                : decodeLocalOperationOutcome(record, actor),
            ] as const,
          ]
        : []
    )
  )
  const superseded = new Set<string>()
  for (const record of s.syncMetadata) {
    if (record.key.startsWith("appearance-resolution:")) {
      const decision = validatePlanOccurrenceResolutionRecord(record, actor)
      if (decision.replacement) {
        const replacements = [
          decision.replacement,
          ...(decision.dependentReplacements ?? []),
        ]
        const first = entries.get(replacements[0].operationId)
        for (let index = 0; index < replacements.length; index++) {
          const operation = replacements[index],
            entry = entries.get(operation.operationId)
          if (
            !first ||
            !entry ||
            entry.userId !== actor ||
            entry.entityKey !== decision.expected.entry.entityKey ||
            entry.sequence !== first.sequence + index ||
            entry.createdAt !== decision.createdAt ||
            JSON.stringify(entry.operation) !== JSON.stringify(operation) ||
            JSON.stringify(entry.dependencies) !==
              JSON.stringify(index ? [replacements[index - 1].operationId] : [])
          )
            throw new Error(
              "Backup appearance retry is missing its exact ordered replacement evidence"
            )
        }
      }
    }
    if (record.key.startsWith("tag-resolution:")) {
      const decision = validateTagResolutionRecord(record, actor)
      if (decision.replacement) {
        const entry = entries.get(decision.replacement.operationId)
        if (
          !entry ||
          entry.userId !== actor ||
          entry.entityKey !== decision.expected.entry.entityKey ||
          entry.createdAt !== decision.createdAt ||
          entry.dependencies.length ||
          JSON.stringify(entry.operation) !==
            JSON.stringify(decision.replacement)
        )
          throw new Error(
            "Backup category retry is missing its exact replacement evidence"
          )
      }
      for (const reviewed of decision.expected.intentions.filter((entry) =>
        decision.supersededOperationIds.includes(entry.operation.operationId)
      )) {
        const entry = entries.get(reviewed.operation.operationId)
        if (
          !entry ||
          entry.userId !== reviewed.userId ||
          entry.entityKey !== reviewed.entityKey ||
          entry.sequence !== reviewed.sequence ||
          entry.attempts !== reviewed.attempts ||
          entry.createdAt !== reviewed.createdAt ||
          JSON.stringify(entry.dependencies) !==
            JSON.stringify(reviewed.dependencies)
        )
          throw new Error(
            "Backup category decision changed its original intention evidence"
          )
      }
    }
    if (record.key.startsWith("settings-resolution:"))
      validateSettingsResolutionRecord(record, actor)
    if ("importId" in record)
      validateBackupImportEvidence(record, entries, actor, recurring)
    if ("result" in record) {
      const entry = entries.get(record.operation.operationId)
      if (
        !entry ||
        JSON.stringify(entry.operation) !== JSON.stringify(record.operation)
      )
        throw new Error("Backup outcome does not match its preserved operation")
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
        const preservedOutcome = outcomes.get(id)?.result.outcome.status
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
        outcome?.result.outcome.status !== "applied") ||
      (entry.state === "conflict" &&
        outcome?.result.outcome.status !== "conflict") ||
      (entry.state === "rejected" &&
        (!outcome ||
          !["unavailable", "invalid_command", "identity_reuse"].includes(
            outcome.result.outcome.status
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

export function encodeLocalRecurringBackup(
  input: unknown,
  userId: string
): string {
  const json = JSON.stringify(validateLocalRecurringBackup(input, userId))
  if (new TextEncoder().encode(json).byteLength > maximumBackupBytes)
    throw new Error("Backup exceeds its size limit")
  return json
}
export function decodeLocalRecurringBackup(
  json: string,
  userId: string
): LocalRecurringBackup {
  if (new TextEncoder().encode(json).byteLength > maximumBackupBytes)
    throw new Error("Backup exceeds its size limit")
  return validateLocalRecurringBackup(JSON.parse(json), userId)
}
