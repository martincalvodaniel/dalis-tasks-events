import { z } from "zod"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import {
  entityIdSchema,
  revisionSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import {
  maximumRemoteOperationReceiptBytes,
  remoteOperationReceiptV2Schema,
} from "@/schemas/remote-operation-receipt-v2"
import {
  maximumRemoteOperationResultBytes,
  remoteOperationResultV2Schema,
} from "@/schemas/remote-operation-result-v2"

const committedOccurrenceSchema = planOccurrenceSchema.safeExtend({
  revision: revisionSchema.min(1),
})
export const remotePlanOccurrenceOutcomeSchema = z.discriminatedUnion(
  "status",
  [
    z.strictObject({
      operationId: entityIdSchema,
      status: z.literal("applied"),
      occurrence: committedOccurrenceSchema,
      seriesRevision: revisionSchema.min(1),
      sequence: revisionSchema.min(1),
    }),
    z
      .strictObject({
        operationId: entityIdSchema,
        status: z.literal("conflict"),
        series: planSchema,
        current: committedOccurrenceSchema.nullable(),
      })
      .refine(
        (value) => !value.current || value.current.seriesId === value.series.id,
        "Conflicting appearance must belong to its series"
      ),
    ...(
      [
        "unavailable",
        "unsupported",
        "invalid_command",
        "identity_reuse",
      ] as const
    ).map((status) =>
      z.strictObject({ operationId: entityIdSchema, status: z.literal(status) })
    ),
  ]
)

// Only the future negotiated reader may consume this branch. Evidence remains version two.
export const remotePlanOccurrenceResultSchema = z
  .strictObject({
    kind: z.literal("plan-occurrence"),
    userId: userIdSchema,
    outcome: remotePlanOccurrenceOutcomeSchema,
  })
  .refine(
    (result) =>
      result.outcome.status !== "conflict" ||
      result.outcome.series.ownerId === result.userId,
    "Appearance conflict data must belong to its actor"
  )
  .refine(
    (result) =>
      new TextEncoder().encode(JSON.stringify(result)).byteLength <=
      maximumRemoteOperationResultBytes,
    "Remote appearance result exceeds its byte limit"
  )

export const remoteRecurringOperationResultSchema = z.union([
  remoteOperationResultV2Schema,
  remotePlanOccurrenceResultSchema,
])
const occurrenceReceiptSchema = z
  .strictObject({
    version: z.literal(2),
    actorUserId: userIdSchema,
    operationId: entityIdSchema,
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    result: remotePlanOccurrenceResultSchema,
    createdAt: timestampSchema,
  })
  .refine(
    (receipt) =>
      receipt.actorUserId === receipt.result.userId &&
      receipt.operationId === receipt.result.outcome.operationId,
    "Appearance receipt actor and operation must match its result"
  )
  .refine(
    (receipt) =>
      new TextEncoder().encode(JSON.stringify(receipt)).byteLength <=
      maximumRemoteOperationReceiptBytes,
    "Remote appearance receipt exceeds its byte limit"
  )

export const remoteRecurringOperationReceiptSchema = z.union([
  remoteOperationReceiptV2Schema,
  occurrenceReceiptSchema,
])
export const remotePlanOccurrenceChangeSchema = z
  .strictObject({
    version: z.literal(2),
    kind: z.literal("plan-occurrence"),
    recipientUserId: userIdSchema,
    operationId: entityIdSchema,
    sequence: revisionSchema.min(1),
    seriesRevision: revisionSchema.min(1),
    occurrence: committedOccurrenceSchema,
  })
  .refine(
    (change) =>
      new TextEncoder().encode(JSON.stringify(change)).byteLength <=
      maximumRemoteOperationResultBytes,
    "Remote appearance journal entry exceeds its byte limit"
  )
