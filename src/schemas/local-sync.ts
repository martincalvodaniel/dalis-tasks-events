import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
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
export const outboxEntrySchema = z
  .strictObject({
    userId: userIdSchema,
    entityKey: itemEntityKeySchema,
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
  .refine(
    (entry) =>
      "itemId" in entry.operation.command &&
      entry.entityKey === `item:${entry.operation.command.itemId}`,
    "Outbox entity does not match its command"
  )
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
