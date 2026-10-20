import { z } from "zod"
import { taskReferenceIdSchema } from "@/schemas/ordering"
import {
  placementGroupReviewInputSchema,
  placementGroupReviewSchema,
} from "@/schemas/placement-group-review"
import { entityIdSchema } from "@/schemas/primitives"

export const categoryPlacementReviewInputSchema =
  placementGroupReviewInputSchema
export const categoryPlacementReviewSchema = placementGroupReviewSchema
  .omit({
    tagId: true,
    localOrder: true,
    observedOrder: true,
  })
  .extend({
    assignmentScope: z.literal("parent_all_dates"),
    parentId: entityIdSchema,
    localTagId: entityIdSchema.nullable(),
    observedTagId: entityIdSchema.nullable(),
    localPositionTagId: entityIdSchema.nullable(),
    observedPositionTagId: entityIdSchema.nullable(),
    parentVisibleIds: z.array(taskReferenceIdSchema).min(1).max(10000),
    groups: z
      .array(
        z.strictObject({
          tagId: entityIdSchema.nullable(),
          localOrder: z.array(taskReferenceIdSchema).max(10000),
          observedOrder: z.array(taskReferenceIdSchema).max(10000),
        })
      )
      .min(2)
      .max(2),
  })
