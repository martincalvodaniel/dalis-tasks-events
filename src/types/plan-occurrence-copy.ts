import type { z } from "zod"
import type {
  planOccurrenceCopyRecordSchema,
  planOccurrenceCopyRequestSchema,
} from "@/schemas/plan-occurrence-copy"

export type PlanOccurrenceCopyRequest = z.infer<
  typeof planOccurrenceCopyRequestSchema
>
export type PlanOccurrenceCopyRecord = z.infer<
  typeof planOccurrenceCopyRecordSchema
>
