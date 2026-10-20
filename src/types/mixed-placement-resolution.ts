import type { z } from "zod"
import type {
  mixedPlacementResolutionRecordSchema,
  mixedPlacementResolutionRequestSchema,
} from "@/schemas/mixed-placement-resolution"

export type MixedPlacementResolutionRequest = z.infer<
  typeof mixedPlacementResolutionRequestSchema
>
export type MixedPlacementResolutionRecord = z.infer<
  typeof mixedPlacementResolutionRecordSchema
>
