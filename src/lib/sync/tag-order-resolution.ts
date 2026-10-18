import {
  captureTagCatalogResolutionSnapshot,
  validateTagCatalogResolutionSnapshot,
} from "@/lib/sync/tag-catalog-resolution"
export function captureTagOrderResolutionSnapshot(input: unknown) {
  return captureTagCatalogResolutionSnapshot(input, "tag.move")
}
export function validateTagOrderResolutionSnapshot(
  input: unknown,
  actor: string
) {
  return validateTagCatalogResolutionSnapshot(input, actor, "tag.move")
}
