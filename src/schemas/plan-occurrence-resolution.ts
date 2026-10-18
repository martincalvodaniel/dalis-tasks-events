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
import { remotePlanOccurrenceOperationSchema } from "@/schemas/remote-plan-occurrence-planning"

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

export const maximumPlanOccurrenceRetryOperations = 103
export const planOccurrenceResolutionRequestSchema = z
  .strictObject({
    userId: userIdSchema,
    resolutionId: entityIdSchema,
    operationId: entityIdSchema.nullable(),
    dependentOperationIds: z
      .array(entityIdSchema)
      .max(maximumPlanOccurrenceRetryOperations - 1)
      .optional(),
    choice: z.enum(["adopt_remote", "retry_local"]),
    createdAt: timestampSchema,
    expected: planOccurrenceIncidentSnapshotSchema,
  })
  .refine(
    (value) =>
      value.choice === "adopt_remote"
        ? value.operationId === null &&
          value.dependentOperationIds === undefined
        : value.operationId !== null &&
          value.dependentOperationIds !== undefined,
    "Appearance choice requires its matching operation identities"
  )
export const planOccurrenceResolutionRecordSchema =
  planOccurrenceResolutionRequestSchema
    .safeExtend({
      key: z.string(),
      local: planOccurrenceSchema,
      replacement: remotePlanOccurrenceOperationSchema.nullable(),
      dependentReplacements: z
        .array(remotePlanOccurrenceOperationSchema)
        .max(maximumPlanOccurrenceRetryOperations - 1)
        .optional(),
      supersededOperationIds: z.array(entityIdSchema).min(1).max(10000),
    })
    .refine(
      (value) =>
        value.key === `appearance-resolution:${value.resolutionId}` &&
        (value.choice === "adopt_remote"
          ? value.replacement === null &&
            value.dependentReplacements === undefined
          : value.replacement?.operationId === value.operationId &&
            value.dependentReplacements?.length ===
              value.dependentOperationIds?.length &&
            value.dependentReplacements?.every(
              (operation, index) =>
                operation.operationId === value.dependentOperationIds?.[index]
            )),
      "Appearance decision does not match its durable identities"
    )
