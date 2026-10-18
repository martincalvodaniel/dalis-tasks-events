import type { z } from "zod"
import type {
  tagOrderResolutionCaptureSchema,
  tagOrderResolutionSnapshotSchema,
} from "@/schemas/tag-order-resolution"

export type TagOrderResolutionCapture = z.infer<
  typeof tagOrderResolutionCaptureSchema
>
export type TagOrderResolutionSnapshot = z.infer<
  typeof tagOrderResolutionSnapshotSchema
>
