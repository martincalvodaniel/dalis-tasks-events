import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import {
  entityIdSchema,
  revisionSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"

export const remoteOperationResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    operationId: entityIdSchema,
    status: z.literal("applied"),
    item: calendarItemSchema,
    sequence: revisionSchema.min(1),
  }),
  z.strictObject({
    operationId: entityIdSchema,
    status: z.literal("conflict"),
    current: calendarItemSchema,
  }),
  ...(["unavailable", "unsupported", "invalid_command"] as const).map(
    (status) =>
      z.strictObject({ operationId: entityIdSchema, status: z.literal(status) })
  ),
])

export const remoteOperationReceiptSchema = z
  .strictObject({
    actorUserId: userIdSchema,
    operationId: entityIdSchema,
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    result: remoteOperationResultSchema,
    createdAt: timestampSchema,
  })
  .refine(
    (receipt) => receipt.operationId === receipt.result.operationId,
    "Receipt result identity must match its operation"
  )
  .refine(
    (receipt) =>
      receipt.result.status === "applied"
        ? receipt.result.item.ownerId === receipt.actorUserId
        : receipt.result.status !== "conflict" ||
          receipt.result.current.ownerId === receipt.actorUserId,
    "Receipt data must belong to its actor"
  )

export const remoteItemChangeSchema = z
  .strictObject({
    recipientUserId: userIdSchema,
    operationId: entityIdSchema,
    sequence: revisionSchema.min(1),
    item: calendarItemSchema,
  })
  .refine(
    (change) => change.recipientUserId === change.item.ownerId,
    "Own item changes must match their recipient"
  )
