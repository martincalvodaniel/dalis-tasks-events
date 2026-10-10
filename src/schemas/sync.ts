import { z } from "zod"
import {
  calendarItemDraftSchema,
  taskStatusSchema,
} from "@/schemas/calendar-item"
import { taskOccurrenceInputSchema } from "@/schemas/occurrence"
import { taskReferenceIdSchema } from "@/schemas/ordering"
import { planCommandSchema } from "@/schemas/plan-command"
import { planOccurrenceCommandSchema } from "@/schemas/plan-occurrence-command"
import { tagDraftSchema, userSettingsInputSchema } from "@/schemas/preferences"
import {
  civilDateSchema,
  entityIdSchema,
  occurrenceIdSchema,
  revisionSchema,
} from "@/schemas/primitives"

export const syncCommandSchema = z.discriminatedUnion("type", [
  ...planOccurrenceCommandSchema.options,
  planCommandSchema.options[3],
  planCommandSchema.options[4],
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
  z.strictObject({
    type: z.literal("task.update-occurrence"),
    itemId: entityIdSchema,
    occurrenceId: occurrenceIdSchema,
    input: taskOccurrenceInputSchema,
  }),
  z.strictObject({
    type: z.literal("task.cancel-occurrence"),
    itemId: entityIdSchema,
    occurrenceId: occurrenceIdSchema,
  }),
  z.strictObject({ type: z.literal("tag.delete"), tagId: entityIdSchema }),
  z
    .strictObject({
      type: z.literal("tag.move"),
      tagId: entityIdSchema,
      beforeId: entityIdSchema.nullable(),
      afterId: entityIdSchema.nullable(),
    })
    .refine(
      (command) =>
        command.beforeId !== command.tagId &&
        command.afterId !== command.tagId &&
        (command.beforeId === null || command.beforeId !== command.afterId),
      "Movement neighbors must have distinct identities"
    ),
  z.strictObject({
    type: z.literal("item-view.set"),
    itemId: entityIdSchema,
    primaryTagId: entityIdSchema.nullable(),
  }),
  z
    .strictObject({
      type: z.literal("task.move"),
      itemId: entityIdSchema,
      occurrenceId: occurrenceIdSchema.nullable(),
      scope: z.enum(["day", "overdue"]),
      date: civilDateSchema,
      tagId: entityIdSchema.nullable(),
      beforeId: taskReferenceIdSchema.nullable(),
      afterId: taskReferenceIdSchema.nullable(),
    })
    .refine(
      (command) =>
        command.beforeId !== (command.occurrenceId ?? command.itemId) &&
        command.afterId !== (command.occurrenceId ?? command.itemId) &&
        (command.beforeId === null || command.beforeId !== command.afterId),
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
