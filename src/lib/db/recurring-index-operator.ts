import "server-only"

import { getPersonalIndexConnectionConfiguration } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { ensureIndexes } from "@/lib/db/ensure-indexes"
import { readRecurringSyncIndexReadiness } from "@/lib/db/mixed-sync-index-readiness"
import {
  executeRecurringIndexProvisioning,
  type RecurringIndexExecutionResult,
} from "@/lib/db/recurring-index-execution"

// Only the standalone operator process owns this singleton's lifetime.
export function runRecurringIndexProvisioning(
  input: unknown
): Promise<RecurringIndexExecutionResult> {
  return executeRecurringIndexProvisioning(input, {
    readConfiguredConnection: getPersonalIndexConnectionConfiguration,
    bootstrapOwnedConnection: async () => {
      // The explicit request acknowledges the registered automatic bootstrap writes.
      const database = await getDatabase()
      return {
        databaseName: database.databaseName,
        readReadiness: readRecurringSyncIndexReadiness,
        createIndex: (spec) => ensureIndexes(database, [spec]),
      }
    },
    closeOwnedConnection: closeDatabaseConnection,
  })
}
