import { z } from "zod"
import { maximumLocalOperationOutcomeBytes } from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { recurringTaskPlacementPlanningInputSchema } from "@/schemas/recurring-task-placement-planning"
import { taskPlacementPlanningInputSchema } from "@/schemas/remote-task-placement-planning"
import { settingsIncidentSnapshotSchema } from "@/schemas/settings-resolution"
import { syncOperationSchema } from "@/schemas/sync"

export const placementResolutionCatalogSchema = z.strictObject({
  occurrences: recurringTaskPlacementPlanningInputSchema.shape.occurrences,
  items: taskPlacementPlanningInputSchema.shape.items,
  tags: taskPlacementPlanningInputSchema.shape.tags,
  views: taskPlacementPlanningInputSchema.shape.views,
  placements: taskPlacementPlanningInputSchema.shape.placements,
})
export const placementResolutionCaptureSchema = z.strictObject({
  userId: userIdSchema,
  incident: settingsIncidentSnapshotSchema,
  entries: z.array(outboxEntrySchema).max(10000),
  local: placementResolutionCatalogSchema,
  observed: placementResolutionCatalogSchema,
})
export const placementResolutionSnapshotSchema = z
  .strictObject({
    incident: settingsIncidentSnapshotSchema,
    local: placementResolutionCatalogSchema,
    observed: placementResolutionCatalogSchema,
    acknowledgedDependencies: z.array(outboxEntrySchema).max(10000),
  })
  .refine(
    (value) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      maximumLocalOperationOutcomeBytes,
    "Placement comparison exceeds its byte limit"
  )

export const placementResolutionRequestSchema = z
  .strictObject({
    userId: userIdSchema,
    resolutionId: entityIdSchema,
    operationId: entityIdSchema.nullable(),
    choice: z.enum(["adopt_remote", "retry_latest_move"]),
    createdAt: timestampSchema,
    expected: placementResolutionSnapshotSchema,
  })
  .refine(
    (value) =>
      (value.choice === "retry_latest_move") === (value.operationId !== null),
    "Placement choice requires its matching operation identity"
  )
export const placementResolutionRecordSchema = placementResolutionRequestSchema
  .safeExtend({
    key: z.string(),
    placements: placementResolutionCatalogSchema.shape.placements,
    replacement: syncOperationSchema.nullable(),
    supersededOperationIds: z.array(entityIdSchema).min(1).max(10000),
  })
  .refine(
    (value) =>
      value.key === `placement-resolution:${value.resolutionId}` &&
      value.operationId === (value.replacement?.operationId ?? null),
    "Placement decision does not match its durable identities"
  )
  .refine(
    (value) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      maximumLocalOperationOutcomeBytes,
    "Placement decision exceeds its byte limit"
  )
