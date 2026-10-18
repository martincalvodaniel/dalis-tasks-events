import { z } from "zod"
import { maximumLocalOperationOutcomeBytes } from "@/schemas/local-preference-outcome-v2"
import { tagSchema } from "@/schemas/preferences"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"
import { tagCatalogResolutionSnapshotSchema } from "@/schemas/tag-catalog-resolution"
export const tagDeletionResolutionRequestSchema = z
  .strictObject({
    userId: userIdSchema,
    resolutionId: entityIdSchema,
    operationId: entityIdSchema.nullable(),
    choice: z.enum(["adopt_remote", "retry_delete"]),
    createdAt: timestampSchema,
    expected: tagCatalogResolutionSnapshotSchema,
  })
  .refine(
    (value) =>
      (value.choice === "retry_delete") === (value.operationId !== null),
    "Category deletion choice requires its matching operation identity"
  )
export const tagDeletionResolutionRecordSchema =
  tagDeletionResolutionRequestSchema
    .safeExtend({
      key: z.string(),
      tags: z.array(tagSchema).max(10000),
      replacement: syncOperationSchema.nullable(),
      supersededOperationIds: z.array(entityIdSchema).length(1),
    })
    .refine(
      (value) =>
        value.key === `tag-delete-resolution:${value.resolutionId}` &&
        value.operationId === (value.replacement?.operationId ?? null),
      "Category deletion decision does not match its durable identities"
    )
    .refine(
      (value) =>
        new TextEncoder().encode(JSON.stringify(value)).byteLength <=
        maximumLocalOperationOutcomeBytes,
      "Category deletion decision exceeds its byte limit"
    )
