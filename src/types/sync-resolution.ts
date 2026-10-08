import type { z } from "zod"
import type {
  syncResolutionRecordSchema,
  syncResolutionRequestSchema,
} from "@/schemas/sync-resolution"

export type SyncResolutionRequest = z.infer<typeof syncResolutionRequestSchema>
export type SyncResolutionRecord = z.infer<typeof syncResolutionRecordSchema>
