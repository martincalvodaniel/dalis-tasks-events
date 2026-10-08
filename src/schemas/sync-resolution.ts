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
  "copy_local",
])
export const syncResolutionRequestSchema = z
  .strictObject({
    userId: userIdSchema,
    resolutionId: entityIdSchema,
    operationId: entityIdSchema.nullable(),
    copyItemId: entityIdSchema.nullable().default(null),
    choice: syncResolutionChoiceSchema,
    createdAt: timestampSchema,
    expected: syncIncidentSnapshotSchema,
  })
  .refine(
    (input) =>
      (input.choice !== "adopt_remote") === (input.operationId !== null) &&
      (input.choice === "copy_local") === (input.copyItemId !== null),
    "Resolution choice requires matching fresh identities"
  )

export const syncResolutionRecordSchema = syncResolutionRequestSchema
  .safeExtend({
    key: z.string(),
    replacement: syncOperationSchema.nullable(),
    local: calendarItemSchema,
    copy: calendarItemSchema.nullable().default(null),
    supersededOperationIds: z.array(entityIdSchema).min(1),
  })
  .refine(
    (record) =>
      record.key === `incident-resolution:${record.resolutionId}` &&
      record.operationId === (record.replacement?.operationId ?? null) &&
      (record.choice === "copy_local"
        ? record.copy?.id === record.copyItemId &&
          record.replacement?.command.type === "item.create" &&
          record.replacement.command.itemId === record.copyItemId
        : record.copy === null),
    "Resolution evidence must match its durable identities"
  )
