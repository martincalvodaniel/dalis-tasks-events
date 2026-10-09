import "server-only"

import { COLLECTION_NAMES } from "@/lib/db/collections"
import {
  INDEX_SPECS,
  type IndexSpec,
  validateIndexSpecs,
} from "@/lib/db/ensure-indexes"
import { mixedSyncIndexNames } from "@/schemas/mixed-sync-index-provisioning"

// Select only the established definitions; callers cannot supply replacement keys or options.
export function selectMixedSyncIndexSpecs(): IndexSpec[] {
  validateIndexSpecs(INDEX_SPECS)
  const selected = mixedSyncIndexNames.map((name) => {
    const collection =
      name === "item_views_user_item_uidx"
        ? COLLECTION_NAMES.itemViews
        : COLLECTION_NAMES.tags
    const candidates = INDEX_SPECS.filter((spec) => spec.options.name === name)
    if (
      candidates.length !== 1 ||
      candidates[0].collection !== collection ||
      candidates[0].provisioning !== "explicit"
    )
      throw new Error(
        "Mixed sync requires its exact registered index selection"
      )
    return structuredClone(candidates[0])
  })
  const staged = INDEX_SPECS.filter(
    (spec) =>
      spec.provisioning === "explicit" &&
      (spec.collection === COLLECTION_NAMES.tags ||
        spec.collection === COLLECTION_NAMES.itemViews)
  )
  if (staged.length !== selected.length)
    throw new Error(
      "Mixed sync index selection contains an unexpected definition"
    )
  validateIndexSpecs(selected)
  return selected
}
