"use client"

import { localDatabaseName } from "@/lib/local-db/client"
import { queueLocalSettingsIncidentOverview } from "@/lib/local-db/sync-incidents"
import {
  type LocalTransactionContext,
  runLocalTransaction,
} from "@/lib/local-db/transaction"
import { capturePlanCategoryResolutionSnapshot } from "@/lib/sync/plan-category-resolution"
import { planCategoryResolutionCaptureSchema } from "@/schemas/plan-category-resolution"
import { itemViewSchema, tagSchema } from "@/schemas/preferences"
import { entityIdSchema, userIdSchema } from "@/schemas/primitives"
import { remoteShadowV2Schema } from "@/schemas/remote-shadow-v2"
import type {
  PlanCategoryResolutionCapture,
  PlanCategoryResolutionSnapshot,
} from "@/types/plan-category-resolution"

export const planCategoryResolutionStoreNames = [
  "settings",
  "items",
  "occurrences",
  "tags",
  "itemViews",
  "taskPlacements",
  "remoteShadows",
  "outbox",
  "syncMetadata",
]

export function queueLocalPlanCategoryResolutionCapture(
  context: Pick<LocalTransactionContext<unknown>, "transaction" | "fail">,
  userIdInput: string,
  operationIdInput: string,
  onCapture: (capture: PlanCategoryResolutionCapture) => void
) {
  const userId = userIdSchema.parse(userIdInput),
    operationId = entityIdSchema.parse(operationIdInput)
  if (context.transaction.db.name !== localDatabaseName(userId))
    throw new Error("Joint capture belongs to another partition")
  queueLocalSettingsIncidentOverview(context, userId, (incidents, entries) => {
    try {
      const found = incidents.find(
        (value) =>
          value.kind === "item" &&
          value.incident.entry.operation.operationId === operationId
      )
      if (found?.kind !== "item")
        throw new Error("Joint content incident is no longer unresolved")
      const command = found.incident.entry.operation.command
      if (!("itemId" in command))
        throw new Error("Joint content incident requires a plan identity")
      const view = context.transaction
        .objectStore("itemViews")
        .get(command.itemId)
      const shadow = context.transaction
        .objectStore("remoteShadows")
        .get(`item-view:${command.itemId}`)
      let localView: PlanCategoryResolutionCapture["localView"] | null = null
      let remoteView: PlanCategoryResolutionCapture["remoteView"] | null = null
      let localTag: PlanCategoryResolutionCapture["localTag"] = null
      let tagReady = false
      const finish = () => {
        if (!localView || !remoteView || !tagReady) return
        try {
          const capture = planCategoryResolutionCaptureSchema.parse({
            userId,
            incident: found.incident,
            entries,
            localView,
            remoteView,
            localTag,
          })
          capturePlanCategoryResolutionSnapshot(capture)
          onCapture(capture)
        } catch (error) {
          context.fail(error)
        }
      }
      view.onsuccess = () => {
        try {
          localView = itemViewSchema.parse(view.result)
          if (localView.primaryTagId) {
            const tag = context.transaction
              .objectStore("tags")
              .get(localView.primaryTagId)
            tag.onsuccess = () => {
              try {
                localTag =
                  tag.result === undefined ? null : tagSchema.parse(tag.result)
                tagReady = true
                finish()
              } catch (error) {
                context.fail(error)
              }
            }
          } else tagReady = true
          finish()
        } catch (error) {
          context.fail(error)
        }
      }
      shadow.onsuccess = () => {
        try {
          const record = remoteShadowV2Schema.parse(shadow.result)
          if (
            record.kind !== "preference" ||
            record.record.store !== "itemViews"
          )
            throw new Error(
              "Joint capture requires the observed remote item view"
            )
          remoteView = record.record.record
          finish()
        } catch (error) {
          context.fail(error)
        }
      }
    } catch (error) {
      context.fail(error)
    }
  })
}

export function readLocalPlanCategoryResolutionSnapshot(
  database: IDBDatabase,
  userId: string,
  operationId: string
): Promise<PlanCategoryResolutionSnapshot> {
  return runLocalTransaction(
    database,
    planCategoryResolutionStoreNames,
    "readonly",
    (context) => {
      queueLocalPlanCategoryResolutionCapture(
        context,
        userId,
        operationId,
        (capture) =>
          context.setResult(capturePlanCategoryResolutionSnapshot(capture))
      )
    }
  )
}
