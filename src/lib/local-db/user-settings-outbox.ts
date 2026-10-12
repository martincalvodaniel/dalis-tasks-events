"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import { parseLocalRecord } from "@/lib/local-db/store-config"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { applyUserSettingsCommand } from "@/lib/preferences/user-settings-command"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import { decodeRemoteShadow } from "@/lib/sync/remote-shadow-v2"
import { outboxEntrySchema, outboxSequenceSchema } from "@/schemas/local-sync"
import { userSettingsSchema } from "@/schemas/preferences"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { syncCommandSchema } from "@/schemas/sync"
import { userSettingsEntityKey } from "@/schemas/user-settings-key"
import type { OutboxEntry } from "@/types/local-sync"
import type { UserSettings } from "@/types/preferences"
import type { SyncCommand } from "@/types/sync"

export type UserSettingsCommitOptions = {
  operationId?: string
  now?: Date
  expectedSettings?: UserSettings | null
}

// Preparatory producer only. Account epoch checks belong to the feature caller; this transaction owns one partition.
export function commitLocalUserSettingsCommand(
  database: IDBDatabase,
  actorInput: unknown,
  input: Extract<SyncCommand, { type: "settings.update" }>,
  options: UserSettingsCommitOptions = {}
): Promise<OutboxEntry> {
  const actor = userIdSchema.parse(actorInput)
  if (database.name !== localDatabaseName(actor))
    return Promise.reject(
      new Error("Personal settings database belongs to another account")
    )
  const parsed = syncCommandSchema.parse(input)
  if (parsed.type !== "settings.update")
    return Promise.reject(
      new Error("Personal settings require their own command")
    )
  const command = parsed
  const operationId = entityIdSchema.parse(
    options.operationId ?? crypto.randomUUID()
  )
  const timestamp = timestampSchema.parse(
    (options.now ?? new Date()).toISOString()
  )
  const expected = Object.hasOwn(options, "expectedSettings")
    ? userSettingsSchema.nullable().parse(options.expectedSettings)
    : undefined
  if (expected && expected.userId !== actor)
    return Promise.reject(
      new Error("Expected settings belong to another account")
    )
  const entityKey = userSettingsEntityKey(actor)
  function ownEntry(input: unknown): OutboxEntry {
    const entry = outboxEntrySchema.parse(input)
    if (entry.userId !== actor)
      throw new Error("Settings intention belongs to another account")
    return entry
  }
  return runLocalTransaction(
    database,
    ["settings", "outbox", "remoteShadows", "syncMetadata"],
    "readwrite",
    (context) => {
      const settings = context.transaction.objectStore("settings")
      const outbox = context.transaction.objectStore("outbox")
      const shadows = context.transaction.objectStore("remoteShadows")
      const metadata = context.transaction.objectStore("syncMetadata")
      const replay = outbox.get(operationId)
      replay.onsuccess = () => {
        try {
          if (replay.result !== undefined) {
            const previous = ownEntry(replay.result)
            if (
              previous.entityKey !== entityKey ||
              JSON.stringify(previous.operation.command) !==
                JSON.stringify(command)
            )
              throw new Error(
                "Operation identity was reused with different settings"
              )
            context.setResult(previous)
            return
          }
          const current = settings.get(actor)
          const shadow = shadows.get(entityKey)
          const sequence = metadata.get("outbox-sequence")
          const latest = outbox
            .index("byEntitySequence")
            .openCursor(
              IDBKeyRange.bound(
                [entityKey, 0],
                [entityKey, Number.MAX_SAFE_INTEGER]
              ),
              "prev"
            )
          let remaining = 4
          function finish() {
            if (--remaining) return
            try {
              const local =
                current.result === undefined
                  ? null
                  : parseLocalRecord("settings", current.result, actor)
              if (
                expected !== undefined &&
                JSON.stringify(expected) !== JSON.stringify(local)
              )
                throw new Error(
                  "Personal settings changed since this editor was opened"
                )
              const observed =
                shadow.result === undefined
                  ? null
                  : decodeRemoteShadow(shadow.result, actor)
              if (
                observed &&
                (observed.kind !== "preference" ||
                  observed.record.store !== "settings" ||
                  observed.entityKey !== entityKey)
              )
                throw new Error("Settings shadow does not match its record")
              if (
                observed?.kind === "preference" &&
                observed.record.record.deletedAt
              )
                throw new Error("Personal settings were removed remotely")
              if (local && local.revision > 0 && !observed)
                throw new Error(
                  "Personal settings revision requires remote evidence"
                )
              const previous = latest.result
                ? ownEntry(latest.result.value)
                : null
              if (previous && previous.entityKey !== entityKey)
                throw new Error("Settings dependency targets another record")
              const nextSequence =
                sequence.result === undefined
                  ? 1
                  : outboxSequenceSchema.parse(sequence.result).value + 1
              const entry = ownEntry({
                userId: actor,
                entityKey,
                sequence: nextSequence,
                operation: {
                  operationId,
                  protocolVersion: 1,
                  baseRevision:
                    observed?.kind === "preference"
                      ? observed.record.record.revision
                      : 0,
                  command,
                },
                dependencies:
                  previous && isUnresolvedOutboxEntry(previous)
                    ? [previous.operation.operationId]
                    : [],
                state: "pending",
                attempts: 0,
                createdAt: timestamp,
                lease: null,
              })
              const record = applyUserSettingsCommand(
                local,
                command.input,
                actor,
                timestamp
              )
              settings.put(record)
              outbox.add(entry)
              metadata.put(
                outboxSequenceSchema.parse({
                  key: "outbox-sequence",
                  value: nextSequence,
                })
              )
              context.setResult(entry)
            } catch (error) {
              context.fail(error)
            }
          }
          current.onsuccess = finish
          shadow.onsuccess = finish
          sequence.onsuccess = finish
          latest.onsuccess = finish
        } catch (error) {
          context.fail(error)
        }
      }
    }
  )
}
