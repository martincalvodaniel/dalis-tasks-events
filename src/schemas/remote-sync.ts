import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import {
  entityIdSchema,
  revisionSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { syncBatchSchema } from "@/schemas/sync"

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
  z.strictObject({ status: z.literal("account_changed") }),
  z.strictObject({ status: z.literal("update_required") }),
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

export const remotePushInputSchema = z
  .strictObject({
    expectedUserId: userIdSchema,
    operations: syncBatchSchema.shape.operations,
  })
  .superRefine((input, context) => {
    const parsed = syncBatchSchema.safeParse({ operations: input.operations })
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        context.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        })
  })

export const remotePullRequestSchema = remotePullQuerySchema.safeExtend({
  expectedUserId: userIdSchema.optional(),
})

export const remoteSyncErrorSchema = z.strictObject({
  error: z.string().max(500),
  code: z.enum(["account_changed", "cursor_ahead"]).optional(),
})

export const remotePushProtocolEnvelopeSchema = z
  .strictObject({
    expectedUserId: userIdSchema,
    operations: z
      .array(
        z.strictObject({
          operationId: entityIdSchema,
          protocolVersion: z.number().int().min(1).max(1000000),
          baseRevision: revisionSchema,
          command: z.record(z.string(), z.unknown()),
        })
      )
      .min(1)
      .max(50),
  })
  .refine(
    (batch) =>
      new Set(batch.operations.map((operation) => operation.operationId))
        .size === batch.operations.length,
    "Duplicate operation identifiers"
  )
  .refine((batch) => {
    try {
      return (
        new TextEncoder().encode(JSON.stringify(batch)).byteLength <= 512 * 1024
      )
    } catch {
      return false
    }
  }, "Sync batch exceeds its size limit")
