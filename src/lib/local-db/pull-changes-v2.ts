"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { planRemoteItemProjection } from "@/lib/sync/item-projection"
import { validateLocalChangesPageInputV2 } from "@/lib/sync/local-changes-page-v2"
import { planLocalMixedPullCursor } from "@/lib/sync/local-mixed-pull-cursor"
import { planLocalPersonalChangesPage } from "@/lib/sync/local-personal-changes-page"
import { planRemotePreferenceProjection } from "@/lib/sync/preference-projection"
import { decodeRemoteShadow } from "@/lib/sync/remote-shadow-v2"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { itemViewSchema, tagSchema } from "@/schemas/preferences"
import { userIdSchema } from "@/schemas/primitives"
import type { PersonalSnapshot } from "@/types/personal-snapshot"

// Account epoch checks belong to the caller; all page effects and cursor commit here.
export function applyLocalChangesPageV2(
  database: IDBDatabase,
  actorInput: unknown,
  receiptInput: unknown
): Promise<"applied" | "ignored"> {
  const userId = userIdSchema.parse(actorInput)
  if (database.name !== localDatabaseName(userId))
    return Promise.reject(
      new Error("Mixed pull database belongs to another partition")
    )
  const receipt = validateLocalChangesPageInputV2(receiptInput, userId)
  return runLocalTransaction(
    database,
    ["items", "tags", "itemViews", "outbox", "remoteShadows", "syncMetadata"],
    "readwrite",
    (context) => {
      const transaction = context.transaction
      const requests = {
        items: transaction.objectStore("items").getAll(undefined, 10001),
        tags: transaction.objectStore("tags").getAll(undefined, 10001),
        views: transaction.objectStore("itemViews").getAll(undefined, 10001),
        entries: transaction.objectStore("outbox").getAll(undefined, 10001),
        shadows: transaction
          .objectStore("remoteShadows")
          .getAll(undefined, 10001),
        cursor: transaction.objectStore("syncMetadata").get("pull-cursor"),
      }
      let remaining = 6
      const finish = () => {
        if (--remaining) return
        try {
          for (const request of [
            requests.items,
            requests.tags,
            requests.views,
            requests.entries,
            requests.shadows,
          ])
            if (request.result.length > 10000)
              throw new Error("Mixed pull snapshot exceeds its record limit")
          const items = new Map(
            requests.items.result.map((input: unknown) => {
              const record = calendarItemSchema.parse(input)
              if (record.ownerId !== userId)
                throw new Error(
                  "Mixed pull stored item belongs to another account"
                )
              return [record.id, record] as const
            })
          )
          const shadows = new Map(
            requests.shadows.result.map((input: unknown) => {
              const shadow = decodeRemoteShadow(input, userId)
              return [shadow.entityKey, shadow] as const
            })
          )
          if (
            items.size !== requests.items.result.length ||
            shadows.size !== requests.shadows.result.length
          )
            throw new Error("Mixed pull snapshot contains duplicate identities")
          const local: PersonalSnapshot = [
            ...requests.tags.result.map((input: unknown) => {
              const record = tagSchema.parse(input)
              return {
                entityKey: `tag:${record.id}`,
                record: { store: "tags" as const, record },
              }
            }),
            ...requests.views.result.map((input: unknown) => {
              const record = itemViewSchema.parse(input)
              return {
                entityKey: `item-view:${record.itemId}`,
                record: { store: "itemViews" as const, record },
              }
            }),
          ]
          const state = {
            userId,
            local,
            incoming: null,
            shadows: [...shadows.values()].filter(
              (shadow) => shadow.kind === "preference"
            ),
            entries: requests.entries.result,
          }
          const originalShadows = new Map(
            [...shadows].map(([key, shadow]) => [key, JSON.stringify(shadow)])
          )
          // Validate the complete stored queue and personal state, including ignored pages.
          planRemotePreferenceProjection(state)
          const decision = planLocalMixedPullCursor(
            receipt,
            requests.cursor.result ?? {
              key: "pull-cursor",
              after: 0,
              through: null,
            },
            userId
          )
          if (decision.status === "ignored") {
            context.setResult("ignored")
            return
          }
          const personal = planLocalPersonalChangesPage(
            { state, receipt },
            userId
          )
          const changedItems = new Set<string>()
          for (const change of receipt.page.changes) {
            if (change.kind !== "item") continue
            const id = change.item.id
            const entityKey = `item:${id}`
            const previous = shadows.get(entityKey)
            if (previous && previous.kind !== "item")
              throw new Error("Mixed pull item shadow has another family")
            const projection = planRemoteItemProjection({
              userId,
              local: items.get(id) ?? null,
              shadow: previous?.record ?? null,
              incoming: change.item,
              entries: state.entries.filter(
                (entry) => entry.entityKey === entityKey
              ),
            })
            if (projection.local) {
              items.set(id, projection.local)
              changedItems.add(id)
            }
            shadows.set(entityKey, {
              version: 2,
              kind: "item",
              entityKey,
              record: projection.shadow,
            })
          }
          for (const shadow of personal.shadows)
            shadows.set(shadow.entityKey, shadow)
          if (shadows.size > 10000 || items.size > 10000)
            throw new Error("Mixed pull exceeds its resulting identity limit")
          for (const id of changedItems)
            transaction.objectStore("items").put(items.get(id))
          for (const entry of personal.local) {
            if (entry.record?.store === "tags")
              transaction.objectStore("tags").put(entry.record.record)
            else if (entry.record?.store === "itemViews")
              transaction.objectStore("itemViews").put(entry.record.record)
          }
          for (const shadow of shadows.values())
            if (
              originalShadows.get(shadow.entityKey) !== JSON.stringify(shadow)
            )
              transaction.objectStore("remoteShadows").put(shadow)
          transaction.objectStore("syncMetadata").put(decision.cursor)
          context.setResult("applied")
        } catch (error) {
          context.fail(error)
        }
      }
      for (const request of Object.values(requests)) request.onsuccess = finish
    }
  )
}
