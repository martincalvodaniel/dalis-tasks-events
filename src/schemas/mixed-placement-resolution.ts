import { z } from "zod"
import {
  placementResolutionRecordSchema,
  placementResolutionRequestSchema,
} from "@/schemas/placement-resolution"

export const mixedPlacementResolutionRequestSchema =
  placementResolutionRequestSchema.safeExtend({
    reviewKind: z.literal("mixed_group"),
  })
export const mixedPlacementResolutionRecordSchema =
  placementResolutionRecordSchema.safeExtend({
    reviewKind: z.literal("mixed_group"),
  })
