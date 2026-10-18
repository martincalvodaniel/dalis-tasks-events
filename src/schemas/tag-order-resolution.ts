import { z } from "zod"
import { maximumLocalOperationOutcomeBytes } from "@/schemas/local-preference-outcome-v2"
import { tagSchema } from "@/schemas/preferences"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"
import {
  tagCatalogResolutionCaptureSchema,
  tagCatalogResolutionSnapshotSchema,
} from "@/schemas/tag-catalog-resolution"

export const tagOrderResolutionCaptureSchema = tagCatalogResolutionCaptureSchema
export const tagOrderResolutionSnapshotSchema =
  tagCatalogResolutionSnapshotSchema

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
