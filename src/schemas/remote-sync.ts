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
  ...(
    ["unavailable", "unsupported", "invalid_command", "identity_reuse"] as const
  ).map((status) =>
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

export const remotePushResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("unauthorized") }),
  z.strictObject({ status: z.literal("invalid_batch") }),
  z.strictObject({
    status: z.literal("complete"),
    results: z.array(remoteOperationResultSchema).min(1).max(50),
  }),
  z.strictObject({
    status: z.literal("retry_later"),
    results: z.array(remoteOperationResultSchema).max(49),
    failedOperationId: entityIdSchema,
  }),
])

const queryIntegerSchema = z.preprocess(
  (value) =>
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value,
  revisionSchema
)
export const remotePullQuerySchema = z
  .strictObject({
    after: queryIntegerSchema.default(0),
    through: queryIntegerSchema.nullable().default(null),
    limit: queryIntegerSchema.pipe(z.number().min(1).max(100)).default(50),
  })
  .refine(
    (query) => query.through === null || query.after <= query.through,
    "Pull cursor cannot exceed its checkpoint"
  )

export const remoteChangesPageSchema = z
  .strictObject({
    changes: z.array(remoteItemChangeSchema).max(100),
    nextAfter: revisionSchema,
    through: revisionSchema,
    hasMore: z.boolean(),
  })
  .refine(
    (page) =>
      page.nextAfter <= page.through &&
      page.hasMore === page.nextAfter < page.through &&
      (!page.changes.length ||
        page.changes.at(-1)?.sequence === page.nextAfter),
    "Change page cursor must match its checkpoint and records"
  )
