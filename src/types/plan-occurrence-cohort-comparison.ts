import type { z } from "zod"
import type { planOccurrenceCohortComparisonSchema } from "@/schemas/plan-occurrence-cohort-comparison"

export type PlanOccurrenceCohortComparison = z.infer<
  typeof planOccurrenceCohortComparisonSchema
>
