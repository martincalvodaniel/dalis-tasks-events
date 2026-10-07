import { z } from "zod"
import {
  calendarItemDraftSchema,
  taskStatusSchema,
} from "@/schemas/calendar-item"
import { tagDraftSchema, userSettingsInputSchema } from "@/schemas/preferences"
import {
  civilDateSchema,
  entityIdSchema,
  occurrenceIdSchema,
  revisionSchema,
} from "@/schemas/primitives"

export const syncCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("item.create"),
    itemId: entityIdSchema,
    input: calendarItemDraftSchema,
  }),
  z.strictObject({
    type: z.literal("item.update"),
    itemId: entityIdSchema,
    input: calendarItemDraftSchema,
  }),
  z.strictObject({ type: z.literal("item.delete"), itemId: entityIdSchema }),
  z.strictObject({
    type: z.literal("task.set-status"),
    itemId: entityIdSchema,
    occurrenceId: occurrenceIdSchema.nullable(),
    status: taskStatusSchema,
  }),
  z.strictObject({
    type: z.literal("task.set-checklist-entry"),
    itemId: entityIdSchema,
    occurrenceId: occurrenceIdSchema.nullable(),
    entryId: entityIdSchema,
    completed: z.boolean(),
  }),
  z.strictObject({
    type: z.literal("tag.save"),
    tagId: entityIdSchema,
    input: tagDraftSchema,
  }),
  z.strictObject({ type: z.literal("tag.delete"), tagId: entityIdSchema }),
  z.strictObject({
    type: z.literal("item-view.set"),
    itemId: entityIdSchema,
    primaryTagId: entityIdSchema.nullable(),
  }),
  z
    .strictObject({
      type: z.literal("task.move"),
      itemId: entityIdSchema,
      occurrenceId: occurrenceIdSchema,
      scope: z.enum(["day", "overdue"]),
      date: civilDateSchema,
      tagId: entityIdSchema.nullable(),
      beforeId: occurrenceIdSchema.nullable(),
      afterId: occurrenceIdSchema.nullable(),
    })
    .refine(
      (command) =>
        command.beforeId !== command.occurrenceId &&
        command.afterId !== command.occurrenceId,
      "A task cannot be positioned relative to itself"
    ),
  z.strictObject({
    type: z.literal("settings.update"),
    input: userSettingsInputSchema,
  }),
])
export const syncOperationSchema = z
  .strictObject({
    operationId: entityIdSchema,
    protocolVersion: z.literal(1),
    baseRevision: revisionSchema,
    command: syncCommandSchema,
  })
  .refine(
    (operation) =>
      operation.command.type !== "item.create" || operation.baseRevision === 0,
    "New items cannot have a remote revision"
  )
export const syncBatchSchema = z
  .strictObject({
    operations: z.array(syncOperationSchema).min(1).max(50),
  })
  .refine(
    (batch) =>
      new Set(batch.operations.map((operation) => operation.operationId))
        .size === batch.operations.length,
    "Duplicate operation identifiers"
  )
  .refine(
    (batch) =>
      new TextEncoder().encode(JSON.stringify(batch)).byteLength <= 512 * 1024,
    "Sync batch exceeds its size limit"
  )
