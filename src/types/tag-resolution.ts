import type { z } from "zod"
import type {
  tagResolutionRecordSchema,
  tagResolutionRequestSchema,
} from "@/schemas/tag-resolution"
export type TagResolutionRequest = z.infer<typeof tagResolutionRequestSchema>
export type TagResolutionRecord = z.infer<typeof tagResolutionRecordSchema>
