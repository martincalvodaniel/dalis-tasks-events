import { z } from "zod"
import { maximumLocalOperationOutcomeBytes } from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { tagSchema } from "@/schemas/preferences"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { remoteTagSchema } from "@/schemas/remote-tag-planning"
import { settingsIncidentSnapshotSchema } from "@/schemas/settings-resolution"
import { syncOperationSchema } from "@/schemas/sync"

export const tagOrderResolutionCaptureSchema = z.strictObject({
  userId: userIdSchema,
  incident: settingsIncidentSnapshotSchema,
  entries: z.array(outboxEntrySchema).max(10000),
  localTags: z.array(tagSchema).max(10000),
  observedTags: z.array(remoteTagSchema).max(10000),
})
export const tagOrderResolutionSnapshotSchema = z
  .strictObject({
    incident: settingsIncidentSnapshotSchema,
    localTags: z.array(tagSchema).max(10000),
    observedTags: z.array(remoteTagSchema).max(10000),
    acknowledgedDependencies: z.array(outboxEntrySchema).max(10000),
  })
  .refine(
    (value) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      maximumLocalOperationOutcomeBytes,
    "Category order comparison exceeds its byte limit"
  )

export const tagOrderResolutionRequestSchema = z
  .strictObject({
    userId: userIdSchema,
    resolutionId: entityIdSchema,
    operationId: entityIdSchema.nullable(),
    choice: z.enum(["adopt_remote", "retry_latest_move"]),
    createdAt: timestampSchema,
    expected: tagOrderResolutionSnapshotSchema,
  })
  .refine(
    (value) =>
      (value.choice === "retry_latest_move") === (value.operationId !== null),
    "Category order choice requires its matching operation identity"
  )

export const tagOrderResolutionRecordSchema = tagOrderResolutionRequestSchema
  .safeExtend({
    key: z.string(),
    tags: z.array(tagSchema).max(10000),
    replacement: syncOperationSchema.nullable(),
    supersededOperationIds: z.array(entityIdSchema).min(1).max(10000),
    latestMoveOperationId: entityIdSchema,
  })
  .refine(
    (value) =>
      value.key === `tag-order-resolution:${value.resolutionId}` &&
      value.operationId === (value.replacement?.operationId ?? null),
    "Category order decision does not match its durable identities"
  )
  .refine(
    (value) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      maximumLocalOperationOutcomeBytes,
    "Category order decision exceeds its byte limit"
  )
