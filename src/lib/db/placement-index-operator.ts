import "server-only"

import { getPersonalIndexConnectionConfiguration } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { ensureIndexes } from "@/lib/db/ensure-indexes"
import { readPlacementSyncIndexReadiness } from "@/lib/db/mixed-sync-index-readiness"
import {
  executePlacementIndexProvisioning,
  type PlacementIndexExecutionResult,
} from "@/lib/db/placement-index-execution"

// Only the standalone operator process owns this singleton's lifetime.
export function runPlacementIndexProvisioning(
  input: unknown
): Promise<PlacementIndexExecutionResult> {
  return executePlacementIndexProvisioning(input, {
    readConfiguredConnection: getPersonalIndexConnectionConfiguration,
    bootstrapOwnedConnection: async () => {
      // The explicit request acknowledges the registered automatic bootstrap writes.
      const database = await getDatabase()
      return {
        databaseName: database.databaseName,
        readReadiness: readPlacementSyncIndexReadiness,
        createIndex: (spec) => ensureIndexes(database, [spec]),
      }
    },
    closeOwnedConnection: closeDatabaseConnection,
  })
}
