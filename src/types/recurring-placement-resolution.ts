import type { z } from "zod"
import type {
  recurringPlacementResolutionRecordSchema,
  recurringPlacementResolutionRequestSchema,
} from "@/schemas/recurring-placement-resolution"
export type RecurringPlacementResolutionRequest = z.infer<
  typeof recurringPlacementResolutionRequestSchema
>
export type RecurringPlacementResolutionRecord = z.infer<
  typeof recurringPlacementResolutionRecordSchema
>
