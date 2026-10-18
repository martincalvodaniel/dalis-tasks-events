import type { z } from "zod"
import type {
  itemViewResolutionRecordSchema,
  itemViewResolutionRequestSchema,
  itemViewResolutionSnapshotSchema,
} from "@/schemas/item-view-resolution"

export type ItemViewResolutionSnapshot = z.infer<
  typeof itemViewResolutionSnapshotSchema
>
export type ItemViewResolutionRequest = z.infer<
  typeof itemViewResolutionRequestSchema
>
export type ItemViewResolutionRecord = z.infer<
  typeof itemViewResolutionRecordSchema
>
