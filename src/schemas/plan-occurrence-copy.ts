import { z } from "zod"
import { maximumLocalOperationOutcomeBytes } from "@/schemas/local-preference-outcome-v2"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import { planOccurrenceIncidentSnapshotSchema } from "@/schemas/plan-occurrence-resolution"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"

export const planOccurrenceCopyRequestSchema = z.strictObject({
  reviewKind: z.literal("occurrence_copy"),
  choice: z.literal("copy_local"),
  userId: userIdSchema,
  resolutionId: entityIdSchema,
  operationId: entityIdSchema,
  copyItemId: entityIdSchema,
  createdAt: timestampSchema,
  expected: planOccurrenceIncidentSnapshotSchema,
})

export const planOccurrenceCopyRecordSchema = planOccurrenceCopyRequestSchema
  .safeExtend({
    key: z.string(),
    local: planOccurrenceSchema,
    copy: planSchema,
    replacement: syncOperationSchema,
    supersededOperationIds: z.array(entityIdSchema).min(1).max(10000),
  })
  .refine(
    (value) =>
      value.key === `appearance-copy-resolution:${value.resolutionId}` &&
      value.copy.id === value.copyItemId &&
      value.replacement.operationId === value.operationId,
    "Appearance copy decision does not match its identities"
  )
  .refine(
    (value) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      maximumLocalOperationOutcomeBytes,
    "Appearance copy decision exceeds its byte limit"
  )
