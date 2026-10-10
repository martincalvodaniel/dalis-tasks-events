"use client"

import { planSaveCommands, preparePlanSave } from "@/lib/calendar/plan-save"
import { parseLocalRecord } from "@/lib/local-db/store-config"
import { notifyLocalOutboxChange } from "@/lib/local-db/sync-notifications"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import {
  outboxEntrySchema,
  outboxSequenceSchema,
  preferenceTailSchema,
} from "@/schemas/local-sync"
import {
  type PlanSaveRequest,
  planSaveRequestSchema,
} from "@/schemas/plan-save"
import { userIdSchema } from "@/schemas/primitives"
import { syncCommandSchema } from "@/schemas/sync"
import type { OutboxEntry } from "@/types/local-sync"

export interface PlanSaveCommit {
  contentEntry: OutboxEntry
  viewEntry: OutboxEntry
  replayed: boolean
}

export function commitLocalPlanSave(
  database: IDBDatabase,
  userId: string,
  input: PlanSaveRequest
): Promise<PlanSaveCommit> {
  const actor = userIdSchema.parse(userId)
  const request = planSaveRequestSchema.parse(input)
  const commands = planSaveCommands(request)
  const contentCommand = syncCommandSchema.parse(commands.content)
  const viewCommand = syncCommandSchema.parse(commands.view)
  const contentKey = `item:${request.itemId}`
  const viewKey = `item-view:${request.itemId}`
  function parseEntry(value: unknown) {
    const entry = outboxEntrySchema.parse(value)
    if (entry.userId !== actor)
      throw new Error("Operation belongs to another account")
    return entry
  }
  return runLocalTransaction<PlanSaveCommit>(
    database,
    ["items", "tags", "itemViews", "outbox", "syncMetadata"],
    "readwrite",
    (context) => {
      const items = context.transaction.objectStore("items")
      const tags = context.transaction.objectStore("tags")
      const views = context.transaction.objectStore("itemViews")
      const outbox = context.transaction.objectStore("outbox")
      const metadata = context.transaction.objectStore("syncMetadata")
      const contentReplay = outbox.get(request.contentOperationId)
      const viewReplay = outbox.get(request.viewOperationId)
      let replayReads = 2
      const checkReplay = () => {
        if (--replayReads !== 0) return
        try {
          if (
            contentReplay.result !== undefined ||
            viewReplay.result !== undefined
          ) {
            if (
              contentReplay.result === undefined ||
              viewReplay.result === undefined
            )
              throw new Error("Plan save has a partial operation replay")
            const contentEntry = parseEntry(contentReplay.result)
            const viewEntry = parseEntry(viewReplay.result)
            if (
              JSON.stringify(contentEntry.operation.command) !==
                JSON.stringify(contentCommand) ||
              JSON.stringify(viewEntry.operation.command) !==
                JSON.stringify(viewCommand) ||
              contentEntry.createdAt !== request.now ||
              viewEntry.createdAt !== request.now ||
              viewEntry.sequence !== contentEntry.sequence + 1 ||
              !viewEntry.dependencies.includes(request.contentOperationId)
            )
              throw new Error(
                "Plan save operation identifiers were reused with different input"
              )
            context.setResult({ contentEntry, viewEntry, replayed: true })
            return
          }
          const item = items.get(request.itemId)
          const view = views.get(request.itemId)
          const tag = request.primaryTagId
            ? tags.get(request.primaryTagId)
            : null
          const sequence = metadata.get("outbox-sequence")
          const preferenceTail = metadata.get("preference-tail")
          function previous(key: string) {
            return outbox
              .index("byEntitySequence")
              .openCursor(
                IDBKeyRange.bound([key, 0], [key, Number.MAX_SAFE_INTEGER]),
                "prev"
              )
          }
          const itemTail = previous(contentKey)
          const viewTail = previous(viewKey)
          const tagTail = request.primaryTagId
            ? previous(`tag:${request.primaryTagId}`)
            : null
          let tailEntry: OutboxEntry | null = null
          let remaining = 6 + (tag ? 1 : 0) + (tagTail ? 1 : 0)
          const finish = () => {
            if (--remaining !== 0) return
            try {
              const currentItem =
                item.result === undefined
                  ? null
                  : parseLocalRecord("items", item.result, actor)
              if (currentItem && currentItem.kind !== "plan")
                throw new Error(
                  "Common plan save cannot change an existing item kind"
                )
              const currentView =
                view.result === undefined
                  ? null
                  : parseLocalRecord("itemViews", view.result, actor)
              const currentTag =
                tag?.result === undefined
                  ? null
                  : parseLocalRecord("tags", tag.result, actor)
              const prepared = preparePlanSave(
                request,
                currentItem,
                currentView,
                currentTag,
                actor
              )
              const priorItem = itemTail.result
                ? parseEntry(itemTail.result.value)
                : null
              const priorView = viewTail.result
                ? parseEntry(viewTail.result.value)
                : null
              const priorTag = tagTail?.result
                ? parseEntry(tagTail.result.value)
                : null
              const nextSequence =
                sequence.result === undefined
                  ? 1
                  : outboxSequenceSchema.parse(sequence.result).value + 1
              function dependencies(candidates: (OutboxEntry | null)[]) {
                return [
                  ...new Set(
                    candidates
                      .filter(
                        (candidate): candidate is OutboxEntry =>
                          candidate !== null &&
                          isUnresolvedOutboxEntry(candidate)
                      )
                      .map((candidate) => candidate.operation.operationId)
                  ),
                ]
              }
              const contentEntry = parseEntry({
                userId: actor,
                entityKey: contentKey,
                sequence: nextSequence,
                operation: {
                  operationId: request.contentOperationId,
                  protocolVersion: 1,
                  baseRevision: currentItem?.revision ?? 0,
                  command: contentCommand,
                },
                dependencies: dependencies([priorItem]),
                state: "pending",
                attempts: 0,
                createdAt: request.now,
                lease: null,
              })
              const viewEntry = parseEntry({
                userId: actor,
                entityKey: viewKey,
                sequence: nextSequence + 1,
                operation: {
                  operationId: request.viewOperationId,
                  protocolVersion: 1,
                  baseRevision: currentView?.revision ?? 0,
                  command: viewCommand,
                },
                dependencies: [
                  request.contentOperationId,
                  ...dependencies([priorItem, priorView, tailEntry, priorTag]),
                ],
                state: "pending",
                attempts: 0,
                createdAt: request.now,
                lease: null,
              })
              items.put(prepared.plan)
              views.put(prepared.view)
              outbox.add(contentEntry)
              outbox.add(viewEntry)
              metadata.put(
                outboxSequenceSchema.parse({
                  key: "outbox-sequence",
                  value: viewEntry.sequence,
                })
              )
              metadata.put(
                preferenceTailSchema.parse({
                  key: "preference-tail",
                  operationId: request.viewOperationId,
                })
              )
              context.setResult({ contentEntry, viewEntry, replayed: false })
            } catch (error) {
              context.fail(error)
            }
          }
          item.onsuccess = finish
          view.onsuccess = finish
          sequence.onsuccess = finish
          itemTail.onsuccess = finish
          viewTail.onsuccess = finish
          if (tag) tag.onsuccess = finish
          if (tagTail) tagTail.onsuccess = finish
          preferenceTail.onsuccess = () => {
            try {
              if (preferenceTail.result === undefined) {
                finish()
                return
              }
              const tailId = preferenceTailSchema.parse(
                preferenceTail.result
              ).operationId
              const previousTail = outbox.get(tailId)
              previousTail.onsuccess = () => {
                try {
                  if (previousTail.result === undefined)
                    throw new Error("Preference dependency is missing")
                  tailEntry = parseEntry(previousTail.result)
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
      contentReplay.onsuccess = checkReplay
      viewReplay.onsuccess = checkReplay
    }
  ).then((result) => {
    if (!result.replayed) notifyLocalOutboxChange(actor)
    return result
  })
}
