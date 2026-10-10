import type { z } from "zod"
import type { planCommandSchema } from "@/schemas/plan-command"
import type {
  planDraftSchema,
  planSchema,
  planVariantSchema,
} from "@/schemas/plan-item"

export type Plan = z.infer<typeof planSchema>
export type PlanDraft = z.infer<typeof planDraftSchema>
export type PlanVariant = z.infer<typeof planVariantSchema>
export type PlanCommand = z.infer<typeof planCommandSchema>
