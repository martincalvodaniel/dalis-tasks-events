import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { itemViewSchema, tagSchema } from "@/schemas/preferences"
import {
  revisionSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"

export const remoteItemViewPlanningInputSchema = z
  .strictObject({
    userId: userIdSchema,
    timestamp: timestampSchema,
    operation: syncOperationSchema,
    item: calendarItemSchema
      .refine(
        (item) => item.revision > 0,
        "Remote item context requires a positive revision"
      )
      .nullable(),
    current: itemViewSchema
      .extend({ revision: revisionSchema.min(1) })
      .nullable(),
    tag: tagSchema.safeExtend({ revision: revisionSchema.min(1) }).nullable(),
  })
  .superRefine((value, context) => {
    for (const field of ["current", "tag"] as const)
      if (value[field] && value[field].userId !== value.userId)
        context.addIssue({
          code: "custom",
          path: [field, "userId"],
          message: "Personal context belongs to another account",
        })
    if (value.item && value.item.ownerId !== value.userId)
      context.addIssue({
        code: "custom",
        path: ["item", "ownerId"],
        message: "Item context belongs to another account",
      })
    const command = value.operation.command
    if (command.type !== "item-view.set") return
    if (value.item && value.item.id !== command.itemId)
      context.addIssue({
        code: "custom",
        path: ["item", "id"],
        message: "Item context identity does not match its command",
      })
    if (value.current && value.current.itemId !== command.itemId)
      context.addIssue({
        code: "custom",
        path: ["current", "itemId"],
        message: "View context identity does not match its command",
      })
    if (
      value.tag &&
      command.primaryTagId !== null &&
      value.tag.id !== command.primaryTagId
    )
      context.addIssue({
        code: "custom",
        path: ["tag", "id"],
        message: "Category context identity does not match its command",
      })
  })
