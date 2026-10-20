import { z } from "zod"
import {
  placementResolutionRecordSchema,
  placementResolutionRequestSchema,
} from "@/schemas/placement-resolution"
import { itemViewSchema } from "@/schemas/preferences"
export const categoryPlacementResolutionRequestSchema =
  placementResolutionRequestSchema.safeExtend({
    reviewKind: z.literal("category_movement"),
  })
export const categoryPlacementResolutionRecordSchema =
  placementResolutionRecordSchema.safeExtend({
    reviewKind: z.literal("category_movement"),
    view: itemViewSchema,
  })
