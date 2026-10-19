import type { z } from "zod"
import type {
  planOccurrenceCohortResolutionRecordSchema,
  planOccurrenceCohortResolutionRequestSchema,
} from "@/schemas/plan-occurrence-cohort-resolution"

export type PlanOccurrenceCohortResolutionRequest = z.infer<
  typeof planOccurrenceCohortResolutionRequestSchema
>
export type PlanOccurrenceCohortResolutionRecord = z.infer<
  typeof planOccurrenceCohortResolutionRecordSchema
>
