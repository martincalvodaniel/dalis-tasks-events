import { z } from "zod"
import {
  placementResolutionRecordSchema,
  placementResolutionRequestSchema,
} from "@/schemas/placement-resolution"

export const recurringPlacementResolutionRequestSchema =
  placementResolutionRequestSchema.safeExtend({
    reviewKind: z.literal("recurring_primary"),
  })
export const recurringPlacementResolutionRecordSchema =
  placementResolutionRecordSchema.safeExtend({
    reviewKind: z.literal("recurring_primary"),
  })
