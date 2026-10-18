import type { z } from "zod"
import type {
  planCategoryResolutionCaptureSchema,
  planCategoryResolutionRecordSchema,
  planCategoryResolutionRequestSchema,
  planCategoryResolutionSnapshotSchema,
} from "@/schemas/plan-category-resolution"
export type PlanCategoryResolutionRequest = z.infer<
  typeof planCategoryResolutionRequestSchema
>
export type PlanCategoryResolutionRecord = z.infer<
  typeof planCategoryResolutionRecordSchema
>
export type PlanCategoryResolutionSnapshot = z.infer<
  typeof planCategoryResolutionSnapshotSchema
>

export type PlanCategoryResolutionCapture = z.infer<
  typeof planCategoryResolutionCaptureSchema
>
