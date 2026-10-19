import { z } from "zod"
import { maximumLocalOperationOutcomeBytes } from "@/schemas/local-preference-outcome-v2"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import { planOccurrenceCohortComparisonSchema } from "@/schemas/plan-occurrence-cohort-comparison"
import {
  entityIdSchema,
  occurrenceIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { remotePlanOccurrenceOperationSchema } from "@/schemas/remote-plan-occurrence-planning"

export const planOccurrenceCohortResolutionRequestSchema = z
  .strictObject({
    userId: userIdSchema,
    resolutionId: entityIdSchema,
    choice: z.enum(["adopt_remote", "retry_local"]),
    operationIds: z.array(entityIdSchema).max(10000),
    createdAt: timestampSchema,
    expected: planOccurrenceCohortComparisonSchema,
  })
  .refine(
    (value) =>
      value.choice === "adopt_remote"
        ? value.operationIds.length === 0
        : value.operationIds.length > 0,
    "Appearance cohort choice requires matching operation identities"
  )

export const planOccurrenceCohortResolutionRecordSchema =
  planOccurrenceCohortResolutionRequestSchema
    .safeExtend({
      key: z.string(),
      locals: z
        .array(
          z.strictObject({
            occurrenceId: occurrenceIdSchema,
            record: planOccurrenceSchema,
          })
        )
        .min(2)
        .max(10000),
      replacements: z
        .array(
          z.strictObject({
            operation: remotePlanOccurrenceOperationSchema,
            dependencies: z.array(entityIdSchema).max(1),
          })
        )
        .max(10000),
      supersededOperationIds: z.array(entityIdSchema).min(2).max(10000),
    })
    .refine(
      (value) =>
        value.key === `appearance-cohort-resolution:${value.resolutionId}` &&
        value.replacements.length === value.operationIds.length &&
        value.replacements.every(
          (entry, index) =>
            entry.operation.operationId === value.operationIds[index]
        ),
      "Appearance cohort decision does not match its durable identities"
    )
    .refine(
      (value) =>
        new TextEncoder().encode(JSON.stringify(value)).byteLength <=
        maximumLocalOperationOutcomeBytes,
      "Appearance cohort decision exceeds its byte limit"
    )
