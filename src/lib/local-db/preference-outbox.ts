"use client"

import {
  applyLocalItemViewCommand,
  applyLocalTagCommand,
  applyLocalTagMoveCommand,
} from "@/lib/local-db/preference-mutation"
import { parseLocalRecord } from "@/lib/local-db/store-config"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import {
  outboxEntrySchema,
  outboxSequenceSchema,
  preferenceTailSchema,
} from "@/schemas/local-sync"
import { tagSchema } from "@/schemas/preferences"
import { entityIdSchema, timestampSchema } from "@/schemas/primitives"
import { syncCommandSchema } from "@/schemas/sync"
import type { LocalPreferenceCommand, OutboxEntry } from "@/types/local-sync"
import type { Tag } from "@/types/preferences"

export function commitLocalPreferenceCommand(
  database: IDBDatabase,
  userId: string,
  input: LocalPreferenceCommand,
  options: { operationId?: string; now?: Date; expectedTag?: Tag } = {}
): Promise<OutboxEntry> {
  const parsed = syncCommandSchema.parse(input)
  if (
    parsed.type !== "tag.save" &&
    parsed.type !== "tag.delete" &&
    parsed.type !== "tag.move" &&
    parsed.type !== "item-view.set"
  )
    return Promise.reject(
      new Error("Command requires its domain mutation layer")
    )
  const command = parsed
  const expected = options.expectedTag
    ? tagSchema.parse(options.expectedTag)
    : undefined
  if (
    expected &&
    (command.type === "item-view.set" ||
      expected.id !== command.tagId ||
      expected.userId !== userId)
  )
    return Promise.reject(
      new Error("Expected category does not match the command")
    )
  const operationId = entityIdSchema.parse(
    options.operationId ?? crypto.randomUUID()
  )
  const timestamp = timestampSchema.parse(
    (options.now ?? new Date()).toISOString()
  )
  const entityKey =
    command.type === "item-view.set"
      ? `item-view:${command.itemId}`
      : `tag:${command.tagId}`
  function parseEntry(value: unknown) {
    const entry = outboxEntrySchema.parse(value)
    if (entry.userId !== userId)
      throw new Error("Operation belongs to another account")
    return entry
  }
  return runLocalTransaction(
    database,
    ["tags", "items", "itemViews", "outbox", "syncMetadata"],
    "readwrite",
    (context) => {
      const tags = context.transaction.objectStore("tags")
      const items = context.transaction.objectStore("items")
      const views = context.transaction.objectStore("itemViews")
      const outbox = context.transaction.objectStore("outbox")
      const metadata = context.transaction.objectStore("syncMetadata")
      const replay = outbox.get(operationId)
      replay.onsuccess = () => {
        try {
          if (replay.result !== undefined) {
            const existing = parseEntry(replay.result)
            if (
              JSON.stringify(existing.operation.command) !==
              JSON.stringify(command)
            )
              throw new Error(
                "Operation ID was reused with a different command"
              )
            context.setResult(existing)
            return
          }
          const allTags = tags.getAll()
          const sequence = metadata.get("outbox-sequence")
          const tail = metadata.get("preference-tail")
          function previousOperation(key: string) {
            return outbox
              .index("byEntitySequence")
              .openCursor(
                IDBKeyRange.bound([key, 0], [key, Number.MAX_SAFE_INTEGER]),
                "prev"
              )
          }
          const previous = previousOperation(entityKey)
          const item =
            command.type === "item-view.set" ? items.get(command.itemId) : null
          const view =
            command.type === "item-view.set" ? views.get(command.itemId) : null
          const itemPrevious =
            command.type === "item-view.set"
              ? previousOperation(`item:${command.itemId}`)
              : null
          let tailEntry: OutboxEntry | null = null
          let remaining = command.type === "item-view.set" ? 7 : 4
          function finish() {
            if (--remaining !== 0) return
            try {
              const records: Tag[] = allTags.result.map((value) =>
                parseLocalRecord("tags", value, userId)
              )
              const current =
                command.type === "item-view.set"
                  ? view?.result === undefined
                    ? null
                    : parseLocalRecord("itemViews", view.result, userId)
                  : (records.find((tag) => tag.id === command.tagId) ?? null)
              if (
                expected &&
                JSON.stringify(current) !== JSON.stringify(expected)
              )
                throw new Error("Category changed since the editor was opened")
              const record =
                command.type === "item-view.set"
                  ? applyLocalItemViewCommand(
                      view?.result === undefined
                        ? null
                        : parseLocalRecord("itemViews", view.result, userId),
                      item?.result === undefined
                        ? null
                        : parseLocalRecord("items", item.result, userId),
                      records.find((tag) => tag.id === command.primaryTagId) ??
                        null,
                      command,
                      userId,
                      timestamp
                    )
                  : command.type === "tag.move"
                    ? applyLocalTagMoveCommand(
                        records,
                        command,
                        userId,
                        timestamp
                      )
                    : applyLocalTagCommand(records, command, userId, timestamp)
              const candidates = [
                tailEntry,
                previous.result ? parseEntry(previous.result.value) : null,
                itemPrevious?.result
                  ? parseEntry(itemPrevious.result.value)
                  : null,
              ]
              const nextSequence =
                sequence.result === undefined
                  ? 1
                  : outboxSequenceSchema.parse(sequence.result).value + 1
              const entry = parseEntry({
                userId,
                entityKey,
                sequence: nextSequence,
                operation: {
                  operationId,
                  protocolVersion: 1,
                  baseRevision: current?.revision ?? 0,
                  command,
                },
                dependencies: [
                  ...new Set(
                    candidates
                      .filter(
                        (candidate): candidate is OutboxEntry =>
                          candidate !== null &&
                          candidate.state !== "acknowledged"
                      )
                      .map((candidate) => candidate.operation.operationId)
                  ),
                ],
                state: "pending",
                attempts: 0,
                createdAt: timestamp,
                lease: null,
              })
              if (command.type === "item-view.set") views.put(record)
              else if (Array.isArray(record))
                for (const tag of record) tags.put(tag)
              else tags.put(record)
              outbox.add(entry)
              metadata.put(
                outboxSequenceSchema.parse({
                  key: "outbox-sequence",
                  value: nextSequence,
                })
              )
              metadata.put(
                preferenceTailSchema.parse({
                  key: "preference-tail",
                  operationId,
                })
              )
              context.setResult(entry)
            } catch (error) {
              context.fail(error)
            }
          }
          allTags.onsuccess = finish
          sequence.onsuccess = finish
          previous.onsuccess = finish
          if (item) item.onsuccess = finish
          if (view) view.onsuccess = finish
          if (itemPrevious) itemPrevious.onsuccess = finish
          tail.onsuccess = () => {
            try {
              if (tail.result === undefined) {
                finish()
                return
              }
              const tailId = preferenceTailSchema.parse(tail.result).operationId
              const request = outbox.get(tailId)
              request.onsuccess = () => {
                try {
                  if (request.result === undefined)
                    throw new Error("Preference dependency is missing")
                  tailEntry = parseEntry(request.result)
                  finish()
                } catch (error) {
                  context.fail(error)
                }
              }
            } catch (error) {
              context.fail(error)
            }
          }
        } catch (error) {
          context.fail(error)
        }
      }
    }
  )
}
