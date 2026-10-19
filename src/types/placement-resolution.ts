import type { z } from "zod"
import type {
  placementResolutionCatalogSchema,
  placementResolutionSnapshotSchema,
} from "@/schemas/placement-resolution"
export type PlacementResolutionCatalog = z.infer<
  typeof placementResolutionCatalogSchema
>
export type PlacementResolutionSnapshot = z.infer<
  typeof placementResolutionSnapshotSchema
>
