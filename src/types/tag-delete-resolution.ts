import type { z } from "zod"
import type {
  tagDeletionResolutionRecordSchema,
  tagDeletionResolutionRequestSchema,
} from "@/schemas/tag-delete-resolution"
export type TagDeletionResolutionRequest = z.infer<
  typeof tagDeletionResolutionRequestSchema
>
export type TagDeletionResolutionRecord = z.infer<
  typeof tagDeletionResolutionRecordSchema
>

export type { TagCatalogResolutionSnapshot as TagDeletionResolutionSnapshot } from "@/types/tag-catalog-resolution"
