import type { z } from "zod"
import type {
  planOccurrenceResolutionRecordSchema,
  planOccurrenceResolutionRequestSchema,
} from "@/schemas/plan-occurrence-resolution"
export type PlanOccurrenceResolutionRequest = z.infer<
  typeof planOccurrenceResolutionRequestSchema
>
export type PlanOccurrenceResolutionRecord = z.infer<
  typeof planOccurrenceResolutionRecordSchema
>
