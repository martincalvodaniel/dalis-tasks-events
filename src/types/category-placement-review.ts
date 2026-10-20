import type { z } from "zod"
import type { categoryPlacementReviewSchema } from "@/schemas/category-placement-review"
export type CategoryPlacementReview = z.infer<
  typeof categoryPlacementReviewSchema
>
