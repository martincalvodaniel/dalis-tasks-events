import { z } from "zod"
import { tagSchema } from "@/schemas/preferences"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { settingsIncidentSnapshotSchema } from "@/schemas/settings-resolution"
import { syncOperationSchema } from "@/schemas/sync"

// Personal incidents share their exact evidence shape; the planner restricts the domain.
export const tagIncidentSnapshotSchema = settingsIncidentSnapshotSchema
export const tagResolutionRequestSchema = z
  .strictObject({
    userId: userIdSchema,
    resolutionId: entityIdSchema,
    operationId: entityIdSchema.nullable(),
    choice: z.enum(["adopt_remote", "retry_local"]),
    createdAt: timestampSchema,
    expected: tagIncidentSnapshotSchema,
  })
  .refine(
    (value) =>
      (value.choice === "retry_local") === (value.operationId !== null),
    "Category choice requires its matching operation identity"
  )
export const tagResolutionRecordSchema = tagResolutionRequestSchema
  .safeExtend({
    key: z.string(),
    local: tagSchema,
    replacement: syncOperationSchema.nullable(),
    supersededOperationIds: z.array(entityIdSchema).min(1).max(10000),
  })
  .refine(
    (value) =>
      value.key === `tag-resolution:${value.resolutionId}` &&
      value.local.userId === value.userId &&
      value.operationId === (value.replacement?.operationId ?? null) &&
      (!value.replacement ||
        (value.replacement.command.type === "tag.save" &&
          value.replacement.command.tagId === value.local.id)),
    "Category decision does not match its durable identities"
  )
