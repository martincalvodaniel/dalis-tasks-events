import "server-only"

import { getPersonalIndexConnectionConfiguration } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { ensureIndexes } from "@/lib/db/ensure-indexes"
import { readMixedSyncIndexReadiness } from "@/lib/db/mixed-sync-index-readiness"
import {
  executePersonalIndexProvisioning,
  type PersonalIndexExecutionResult,
} from "@/lib/db/personal-index-execution"

// Only the standalone operator process owns this singleton's lifetime.
export function runPersonalIndexProvisioning(
  input: unknown
): Promise<PersonalIndexExecutionResult> {
  return executePersonalIndexProvisioning(input, {
    readConfiguredConnection: getPersonalIndexConnectionConfiguration,
    bootstrapOwnedConnection: async () => {
      // The explicit request acknowledges the registered automatic bootstrap writes.
      const database = await getDatabase()
      return {
        databaseName: database.databaseName,
        readReadiness: readMixedSyncIndexReadiness,
        createIndex: (spec) => ensureIndexes(database, [spec]),
      }
    },
    closeOwnedConnection: closeDatabaseConnection,
  })
}
