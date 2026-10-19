import { z } from "zod"
import { maximumLocalOperationOutcomeBytes } from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { userIdSchema } from "@/schemas/primitives"
import { taskPlacementPlanningInputSchema } from "@/schemas/remote-task-placement-planning"
import { settingsIncidentSnapshotSchema } from "@/schemas/settings-resolution"

export const placementResolutionCatalogSchema = z.strictObject({
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
