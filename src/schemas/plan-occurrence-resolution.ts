import { z } from "zod"
import { localPlanOccurrenceOutcomeSchema } from "@/schemas/local-plan-occurrence-sync"
import { maximumLocalOperationOutcomeBytes } from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"

export const planOccurrenceIncidentSnapshotSchema = z
  .strictObject({
    entry: outboxEntrySchema,
    reason: z.enum([
      "conflict",
      "unavailable",
      "invalid_command",
      "identity_reuse",
    ]),
    outcome: localPlanOccurrenceOutcomeSchema,
    series: planSchema,
    seriesAtOutcome: planSchema.nullable(),
    local: planOccurrenceSchema.nullable(),
    localAtOutcome: planOccurrenceSchema.nullable(),
    shadowAtOutcome: planOccurrenceSchema.nullable(),
    remote: planOccurrenceSchema.nullable(),
    intentions: z.array(outboxEntrySchema).min(1).max(10000),
    blockedByRelatedIntentions: z.boolean(),
  })
  .refine(
    (value) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      maximumLocalOperationOutcomeBytes,
    "Appearance comparison exceeds its byte limit"
  )

export const planOccurrenceResolutionRequestSchema = z.strictObject({
  userId: userIdSchema,
  resolutionId: entityIdSchema,
  operationId: z.null(),
  choice: z.literal("adopt_remote"),
  createdAt: timestampSchema,
  expected: planOccurrenceIncidentSnapshotSchema,
})
export const planOccurrenceResolutionRecordSchema =
  planOccurrenceResolutionRequestSchema
    .safeExtend({
      key: z.string(),
      local: planOccurrenceSchema,
      replacement: z.null(),
      supersededOperationIds: z.array(entityIdSchema).min(1).max(10000),
    })
    .refine(
      (value) => value.key === `appearance-resolution:${value.resolutionId}`,
      "Appearance decision identity does not match its durable key"
    )
