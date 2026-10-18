import { z } from "zod"
import { maximumLocalOperationOutcomeBytes } from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planCategoryRecoveryChainInputSchema } from "@/schemas/plan-category-recovery-chain"
import { planSchema } from "@/schemas/plan-item"
import { itemViewSchema, tagSchema } from "@/schemas/preferences"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"
import { syncIncidentSnapshotSchema } from "@/schemas/sync-incident"

export const planCategoryResolutionCaptureSchema =
  planCategoryRecoveryChainInputSchema.extend({
    localView: itemViewSchema,
    remoteView: itemViewSchema,
    localTag: tagSchema.nullable(),
  })
export const planCategoryResolutionSnapshotSchema = z
  .strictObject({
    incident: syncIncidentSnapshotSchema,
    viewIntentions: z.array(outboxEntrySchema).min(1).max(10000),
    acknowledgedDependencies: z.array(outboxEntrySchema).max(10000),
    localView: itemViewSchema,
    remoteView: itemViewSchema,
    localTag: tagSchema.nullable(),
  })
  .refine(
    (value) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      maximumLocalOperationOutcomeBytes,
    "Joint comparison exceeds its byte limit"
  )
export const planCategoryResolutionRequestSchema = z
  .strictObject({
    userId: userIdSchema,
    resolutionId: entityIdSchema,
    operationId: entityIdSchema.nullable(),
    viewOperationId: entityIdSchema.nullable(),
    choice: z.enum(["adopt_remote", "retry_local"]),
    createdAt: timestampSchema,
    expected: planCategoryResolutionSnapshotSchema,
  })
  .refine(
    (value) =>
      value.choice === "adopt_remote"
        ? value.operationId === null && value.viewOperationId === null
        : value.operationId !== null && value.viewOperationId !== null,
    "Joint choice requires matching fresh identities"
  )
export const planCategoryResolutionRecordSchema =
  planCategoryResolutionRequestSchema
    .safeExtend({
      key: z.string(),
      local: planSchema,
      view: itemViewSchema,
      replacement: syncOperationSchema.nullable(),
      viewReplacement: syncOperationSchema.nullable(),
      supersededOperationIds: z.array(entityIdSchema).min(2).max(10000),
    })
    .refine(
      (value) =>
        value.key === `plan-category-resolution:${value.resolutionId}` &&
        value.operationId === (value.replacement?.operationId ?? null) &&
        value.viewOperationId === (value.viewReplacement?.operationId ?? null),
      "Joint decision does not match its durable identities"
    )
