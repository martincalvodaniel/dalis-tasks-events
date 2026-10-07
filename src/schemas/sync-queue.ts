import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { userIdSchema } from "@/schemas/primitives"

export const syncQueueSnapshotSchema = z
  .strictObject({
    userId: userIdSchema,
    entries: z.array(outboxEntrySchema),
    items: z.array(calendarItemSchema),
  })
  .refine(
    (value) =>
      value.entries.every((entry) => entry.userId === value.userId) &&
      value.items.every((item) => item.ownerId === value.userId),
    "Queue snapshot belongs to another account"
  )
  .refine(
    (value) =>
      new Set(value.entries.map((entry) => entry.operation.operationId))
        .size === value.entries.length &&
      new Set(value.entries.map((entry) => entry.sequence)).size ===
        value.entries.length &&
      new Set(value.items.map((item) => item.id)).size === value.items.length,
    "Queue snapshot contains duplicate identities"
  )

const count = z.number().int().min(0)
export const syncQueueSummarySchema = z
  .strictObject({
    pending: count,
    ready: count,
    waiting: count,
    blocked: count,
    unsupported: count,
    sending: count,
    conflicts: count,
    rejected: count,
  })
  .refine(
    (value) =>
      value.pending ===
      value.ready + value.waiting + value.blocked + value.unsupported,
    "Pending queue counts are inconsistent"
  )
