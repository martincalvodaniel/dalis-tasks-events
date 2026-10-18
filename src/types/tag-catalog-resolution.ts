import type { z } from "zod"
import type {
  tagCatalogResolutionCaptureSchema,
  tagCatalogResolutionSnapshotSchema,
} from "@/schemas/tag-catalog-resolution"
export type TagCatalogResolutionCapture = z.infer<
  typeof tagCatalogResolutionCaptureSchema
>
export type TagCatalogResolutionSnapshot = z.infer<
  typeof tagCatalogResolutionSnapshotSchema
>
