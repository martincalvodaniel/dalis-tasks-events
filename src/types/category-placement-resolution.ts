import type { z } from "zod"
import type {
  categoryPlacementResolutionRecordSchema,
  categoryPlacementResolutionRequestSchema,
} from "@/schemas/category-placement-resolution"
export type CategoryPlacementResolutionRequest = z.infer<
  typeof categoryPlacementResolutionRequestSchema
>
export type CategoryPlacementResolutionRecord = z.infer<
  typeof categoryPlacementResolutionRecordSchema
>
