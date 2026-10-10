import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { overduePlacementDate, taskReferenceIdSchema } from "@/schemas/ordering"
import {
  itemViewSchema,
  tagSchema,
  taskPlacementSchema,
} from "@/schemas/preferences"
import {
  revisionSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"

export const maximumRemoteTaskCatalog = 10000
export const remoteTaskCatalogItemSchema = calendarItemSchema.refine(
  (item) => item.revision > 0,
  "Remote items require a positive revision"
)
export const remoteTaskPlacementKeySchema = taskPlacementSchema
  .pick({ occurrenceId: true, scope: true, date: true })
  .extend({ occurrenceId: taskReferenceIdSchema })
  .refine(
    (record) =>
      record.scope !== "overdue" || record.date === overduePlacementDate,
    "Remote overdue placements require their canonical date"
  )
export const remoteTaskPlacementSchema = taskPlacementSchema
  .extend({
    revision: revisionSchema.min(1),
    occurrenceId: taskReferenceIdSchema,
  })
  .refine(
    (record) =>
      record.scope !== "overdue" || record.date === overduePlacementDate,
    "Remote overdue placements require their canonical date"
  )

export const taskPlacementPlanningInputSchema = z
  .strictObject({
    userId: userIdSchema,
    timestamp: timestampSchema,
    operation: syncOperationSchema,
    items: z.array(calendarItemSchema).max(maximumRemoteTaskCatalog),
    tags: z.array(tagSchema).max(maximumRemoteTaskCatalog),
    views: z.array(itemViewSchema).max(maximumRemoteTaskCatalog),
    placements: z
      .array(
        taskPlacementSchema.refine(
          (record) =>
            record.scope !== "overdue" || record.date === overduePlacementDate,
          "Overdue placements require their canonical date"
        )
      )
      .max(maximumRemoteTaskCatalog),
  })
  .superRefine((value, context) => {
    for (const field of ["items", "tags", "views", "placements"] as const) {
      const identities = new Set<string>()
      for (const [index, record] of value[field].entries()) {
        const owner = "ownerId" in record ? record.ownerId : record.userId
        if (owner !== value.userId)
          context.addIssue({
            code: "custom",
            path: [field, index],
            message: "Movement context belongs to another account",
          })
        const key =
          "occurrenceId" in record
            ? JSON.stringify([record.occurrenceId, record.scope, record.date])
            : "itemId" in record
              ? record.itemId
              : record.id
        if (identities.has(key))
          context.addIssue({
            code: "custom",
            path: [field, index],
            message: "Duplicate movement context identity",
          })
        identities.add(key)
      }
    }
    const names = new Set<string>()
    for (const [index, tag] of value.tags.entries()) {
      if (tag.deletedAt) continue
      if (names.has(tag.normalizedName))
        context.addIssue({
          code: "custom",
          path: ["tags", index],
          message: "Duplicate active category name",
        })
      names.add(tag.normalizedName)
    }
  })

export const remoteTaskPlacementPlanningInputSchema =
  taskPlacementPlanningInputSchema.superRefine((value, context) => {
    for (const field of ["items", "tags", "views", "placements"] as const) {
      for (const [index, record] of value[field].entries()) {
        if (record.revision < 1)
          context.addIssue({
            code: "custom",
            path: [field, index, "revision"],
            message: "Remote movement context requires a positive revision",
          })
      }
    }
  })
