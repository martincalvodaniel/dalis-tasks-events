import type { z } from "zod"
import type {
  tagOrderResolutionCaptureSchema,
  tagOrderResolutionRecordSchema,
  tagOrderResolutionRequestSchema,
  tagOrderResolutionSnapshotSchema,
} from "@/schemas/tag-order-resolution"

export type TagOrderResolutionCapture = z.infer<
  typeof tagOrderResolutionCaptureSchema
>
export type TagOrderResolutionSnapshot = z.infer<
  typeof tagOrderResolutionSnapshotSchema
>

export type TagOrderResolutionRequest = z.infer<
  typeof tagOrderResolutionRequestSchema
>
export type TagOrderResolutionRecord = z.infer<
  typeof tagOrderResolutionRecordSchema
>
