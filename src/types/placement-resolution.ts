import type { z } from "zod"
import type {
  placementResolutionCatalogSchema,
  placementResolutionRecordSchema,
  placementResolutionRequestSchema,
  placementResolutionSnapshotSchema,
} from "@/schemas/placement-resolution"
export type PlacementResolutionCatalog = z.infer<
  typeof placementResolutionCatalogSchema
>
export type PlacementResolutionSnapshot = z.infer<
  typeof placementResolutionSnapshotSchema
>

export type PlacementResolutionRequest = z.infer<
  typeof placementResolutionRequestSchema
>
export type PlacementResolutionRecord = z.infer<
  typeof placementResolutionRecordSchema
>
