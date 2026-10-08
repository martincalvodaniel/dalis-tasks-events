"use client"

import { runLocalTransaction } from "@/lib/local-db/transaction"
import { readItemShadow } from "@/lib/sync/item-evidence"
import { planRemoteItemProjection } from "@/lib/sync/item-projection"
import { calendarItemSchema } from "@/schemas/calendar-item"
import {
  localChangesPageInputSchema,
  localPullCursorSchema,
  outboxEntrySchema,
  remoteShadowSchema,
} from "@/schemas/local-sync"
import { userIdSchema } from "@/schemas/primitives"
import type { CalendarItem } from "@/types/calendar-item"

export class LocalCursorChangedError extends Error {
  constructor() {
    super("Local pull cursor or checkpoint changed before applying the page")
  }
}

export function applyLocalChangesPage(
  database: IDBDatabase,
  actorInput: string,
  input: unknown
): Promise<"applied" | "ignored"> {
  const userId = userIdSchema.parse(actorInput)
  const { after, page } = localChangesPageInputSchema.parse(input)
  const incoming = new Map<string, CalendarItem>()
  for (const change of page.changes) {
    if (
      change.recipientUserId !== userId ||
      change.item.ownerId !== userId ||
      change.item.revision < 1
    )
      return Promise.reject(
        new Error(
          "Pull change does not belong to this account or a committed revision"
        )
      )
    const previous = incoming.get(change.item.id)
    if (previous && change.item.revision <= previous.revision)
      return Promise.reject(
        new Error("Pull item revisions must advance within a page")
      )
    incoming.set(change.item.id, change.item)
  }
  const own = (value: unknown) => {
    if (value === undefined) return null
    const item = calendarItemSchema.parse(value)
    if (item.ownerId !== userId)
      throw new Error("Stored sync item belongs to another account")
    return item
  }
  return runLocalTransaction(
    database,
    ["items", "outbox", "remoteShadows", "syncMetadata"],
    "readwrite",
    (context) => {
      const items = context.transaction.objectStore("items")
      const outbox = context.transaction.objectStore("outbox")
      const shadows = context.transaction.objectStore("remoteShadows")
      const metadata = context.transaction.objectStore("syncMetadata")
      const cursorRequest = metadata.get("pull-cursor")
      cursorRequest.onsuccess = () => {
        try {
          const cursor = localPullCursorSchema.parse(
            cursorRequest.result ?? {
              key: "pull-cursor",
              after: 0,
              through: null,
            }
          )
          if (after < cursor.after && page.nextAfter <= cursor.after) {
            context.setResult("ignored")
            return
          }
          if (
            after !== cursor.after ||
            (cursor.through !== null && cursor.through !== page.through)
          )
            throw new LocalCursorChangedError()
          const commitCursor = () => {
            metadata.put(
              localPullCursorSchema.parse({
                key: "pull-cursor",
                after: page.nextAfter,
                through: page.hasMore ? page.through : null,
              })
            )
            context.setResult("applied")
          }
          if (!incoming.size) {
            commitCursor()
            return
          }
          let remaining = incoming.size
          for (const [id, record] of incoming) {
            const entityKey = `item:${id}`
            const itemRequest = items.get(id)
            const shadowRequest = shadows.get(entityKey)
            const entriesRequest = outbox
              .index("byEntitySequence")
              .getAll(
                IDBKeyRange.bound(
                  [entityKey, 0],
                  [entityKey, Number.MAX_SAFE_INTEGER]
                )
              )
            let ready = 3
            const finish = () => {
              if (--ready) return
              try {
                const shadow =
                  shadowRequest.result === undefined
                    ? null
                    : own(readItemShadow(shadowRequest.result, userId).record)
                const projection = planRemoteItemProjection({
                  userId,
                  local: own(itemRequest.result),
                  shadow,
                  incoming: record,
                  entries: entriesRequest.result.map((value) =>
                    outboxEntrySchema.parse(value)
                  ),
                })
                if (projection.local) items.put(projection.local)
                shadows.put(
                  remoteShadowSchema.parse({
                    entityKey,
                    record: projection.shadow,
                  })
                )
                if (--remaining === 0) commitCursor()
              } catch (error) {
                context.fail(error)
              }
            }
            itemRequest.onsuccess = finish
            shadowRequest.onsuccess = finish
            entriesRequest.onsuccess = finish
          }
        } catch (error) {
          context.fail(error)
        }
      }
    }
  )
}
