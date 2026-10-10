import type { z } from "zod"
import type { planOccurrenceSchema } from "@/schemas/plan-occurrence"

export type PlanOccurrence = z.infer<typeof planOccurrenceSchema>
