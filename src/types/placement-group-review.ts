import type { z } from "zod"
import type { placementGroupReviewSchema } from "@/schemas/placement-group-review"

export type PlacementGroupReview = z.infer<typeof placementGroupReviewSchema>
