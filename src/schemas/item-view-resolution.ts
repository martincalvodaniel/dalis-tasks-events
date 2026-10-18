import { z } from "zod"
import { maximumLocalOperationOutcomeBytes } from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"
import { itemViewSchema, tagSchema } from "@/schemas/preferences"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { settingsIncidentSnapshotSchema } from "@/schemas/settings-resolution"
import { syncOperationSchema } from "@/schemas/sync"

export const itemViewResolutionCaptureSchema = z.strictObject({
  userId: userIdSchema,
  incident: settingsIncidentSnapshotSchema,
  entries: z.array(outboxEntrySchema).max(10000),
  parent: planSchema,
  localTag: tagSchema.nullable(),
})
export const itemViewResolutionSnapshotSchema = z
  .strictObject({
    incident: settingsIncidentSnapshotSchema,
    parent: planSchema,
    localTag: tagSchema.nullable(),
    acknowledgedDependencies: z.array(outboxEntrySchema).max(10000),
  })
  .refine(
    (value) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      maximumLocalOperationOutcomeBytes,
    "Assignment comparison exceeds its byte limit"
  )
export const itemViewResolutionRequestSchema = z
  .strictObject({
    userId: userIdSchema,
    resolutionId: entityIdSchema,
    operationId: entityIdSchema.nullable(),
    choice: z.enum(["adopt_remote", "retry_local"]),
    createdAt: timestampSchema,
    expected: itemViewResolutionSnapshotSchema,
  })
  .refine(
    (value) =>
      (value.choice === "retry_local") === (value.operationId !== null),
    "Assignment choice requires its matching operation identity"
  )
export const itemViewResolutionRecordSchema = itemViewResolutionRequestSchema
  .safeExtend({
    key: z.string(),
    local: itemViewSchema,
    replacement: syncOperationSchema.nullable(),
    supersededOperationIds: z.array(entityIdSchema).min(1).max(10000),
  })
  .refine(
    (value) =>
      value.key === `item-view-resolution:${value.resolutionId}` &&
      value.local.userId === value.userId &&
      value.operationId === (value.replacement?.operationId ?? null),
    "Assignment decision does not match its durable identities"
  )
