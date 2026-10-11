import { z } from "zod"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"

export const commonPlanLocalReleaseSchema = z.strictObject({
  key: z.literal("common-plan-release"),
  version: z.literal(4),
  userId: userIdSchema,
  preparedAt: timestampSchema,
  operationId: entityIdSchema.nullable(),
})
export const commonPlanLocalResetSchema = z.strictObject({
  operationId: entityIdSchema,
  preparedAt: timestampSchema,
})
export const commonPlanContentStores = [
  "items",
  "occurrences",
  "tags",
  "itemViews",
  "taskPlacements",
  "memberships",
  "invitations",
  "outbox",
  "remoteShadows",
  "syncMetadata",
] as const
export type CommonPlanLocalReleaseState =
  | { status: "ready" }
  | { status: "reset_required"; recordCount: number }
