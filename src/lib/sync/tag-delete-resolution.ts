import {
  captureTagCatalogResolutionSnapshot,
  validateTagCatalogResolutionSnapshot,
} from "@/lib/sync/tag-catalog-resolution"
export function captureTagDeletionResolutionSnapshot(input: unknown) {
  return captureTagCatalogResolutionSnapshot(input, "tag.delete")
}
export function validateTagDeletionResolutionSnapshot(
  input: unknown,
  actor: string
) {
  return validateTagCatalogResolutionSnapshot(input, actor, "tag.delete")
}
