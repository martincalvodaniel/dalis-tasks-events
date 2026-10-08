import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"
import { syncIncidentSnapshotSchema } from "@/schemas/sync-incident"

export const syncResolutionChoiceSchema = z.enum([
  "adopt_remote",
  "retry_local",
])
export const syncResolutionRequestSchema = z
  .strictObject({
    userId: userIdSchema,
    resolutionId: entityIdSchema,
    operationId: entityIdSchema.nullable(),
    choice: syncResolutionChoiceSchema,
    createdAt: timestampSchema,
    expected: syncIncidentSnapshotSchema,
  })
  .refine(
    (input) =>
      (input.choice === "retry_local") === (input.operationId !== null),
    "Only local retries require a new operation identity"
  )

export const syncResolutionRecordSchema = syncResolutionRequestSchema
  .safeExtend({
    key: z.string(),
    replacement: syncOperationSchema.nullable(),
    local: calendarItemSchema,
    supersededOperationIds: z.array(entityIdSchema).min(1),
  })
  .refine(
    (record) =>
      record.key === `incident-resolution:${record.resolutionId}` &&
      record.operationId === (record.replacement?.operationId ?? null),
    "Resolution evidence must match its durable identities"
  )
