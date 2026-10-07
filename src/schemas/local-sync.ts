import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import {
  taskPlacementEntityKey,
  taskPlacementEntityKeySchema,
} from "@/schemas/ordering"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"

export const itemEntityKeySchema = z
  .string()
  .refine(
    (value) =>
      value.startsWith("item:") &&
      entityIdSchema.safeParse(value.slice(5)).success,
    "Invalid item entity key"
  )
export const personalEntityKeySchema = z.string().refine((value) => {
  const prefix = value.startsWith("tag:")
    ? "tag:"
    : value.startsWith("item-view:")
      ? "item-view:"
      : null
  return (
    prefix !== null &&
    entityIdSchema.safeParse(value.slice(prefix.length)).success
  )
}, "Invalid personal entity key")
export const outboxEntityKeySchema = z.union([
  itemEntityKeySchema,
  personalEntityKeySchema,
  taskPlacementEntityKeySchema,
])
export const outboxEntrySchema = z
  .strictObject({
    userId: userIdSchema,
    entityKey: outboxEntityKeySchema,
    operation: syncOperationSchema,
    sequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    dependencies: z.array(entityIdSchema).max(32),
    state: z.enum([
      "pending",
      "sending",
      "acknowledged",
      "conflict",
      "rejected",
    ]),
    attempts: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    createdAt: timestampSchema,
    lease: z
      .strictObject({ ownerId: entityIdSchema, expiresAt: timestampSchema })
      .nullable(),
  })
  .refine(
    (entry) => (entry.state === "sending") === (entry.lease !== null),
    "Sending state requires a lease"
  )
  .refine((entry) => {
    const command = entry.operation.command
    if (
      command.type === "tag.save" ||
      command.type === "tag.delete" ||
      command.type === "tag.move"
    )
      return entry.entityKey === `tag:${command.tagId}`
    if (command.type === "item-view.set")
      return entry.entityKey === `item-view:${command.itemId}`
    if (command.type === "task.move")
      return (
        entry.entityKey ===
          taskPlacementEntityKey(
            command.occurrenceId ?? command.itemId,
            command.scope,
            command.date
          ) ||
        (command.occurrenceId !== null &&
          entry.entityKey === `item:${command.itemId}`)
      )
    return "itemId" in command && entry.entityKey === `item:${command.itemId}`
  }, "Outbox entity does not match its command")
  .refine(
    (entry) =>
      new Set(entry.dependencies).size === entry.dependencies.length &&
      !entry.dependencies.includes(entry.operation.operationId),
    "Invalid operation dependencies"
  )

export const remoteShadowSchema = z
  .strictObject({
    entityKey: itemEntityKeySchema,
    record: calendarItemSchema,
  })
  .refine(
    (shadow) => shadow.entityKey === `item:${shadow.record.id}`,
    "Shadow entity does not match its record"
  )

export const outboxSequenceSchema = z.strictObject({
  key: z.literal("outbox-sequence"),
  value: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
})

export const preferenceTailSchema = z.strictObject({
  key: z.literal("preference-tail"),
  operationId: entityIdSchema,
})
