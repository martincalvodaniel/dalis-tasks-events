import { automaticIndexSpecs } from "@/lib/db/ensure-indexes"
import { selectPlacementSyncIndexSpecs } from "@/lib/db/mixed-sync-index-specs"

// This command reviews registered definitions without inspecting or connecting to a database.
if (process.argv.slice(2).length !== 0) {
  console.error("Placement index preview does not accept arguments.")
  process.exitCode = 1
} else {
  console.log(
    JSON.stringify(
      {
        scope: "offline_definition_preview",
        databaseAccess: "none",
        automaticIndexes: automaticIndexSpecs(),
        indexes: selectPlacementSyncIndexSpecs(),
      },
      null,
      2
    )
  )
}
