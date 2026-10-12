import "server-only"

import {
  executeIndexProvisioning,
  type IndexExecutionPorts,
  type IndexExecutionResult,
} from "@/lib/db/index-execution-core"
import { provisionRecurringSyncIndexes } from "@/lib/db/recurring-sync-index-provisioning"

type IndexName = Awaited<
  ReturnType<typeof provisionRecurringSyncIndexes>
>["created"][number]
export type RecurringIndexExecutionPorts = IndexExecutionPorts
export type RecurringIndexExecutionResult = IndexExecutionResult<IndexName>

export function executeRecurringIndexProvisioning(
  input: unknown,
  ports: RecurringIndexExecutionPorts
): Promise<RecurringIndexExecutionResult> {
  return executeIndexProvisioning(input, ports, provisionRecurringSyncIndexes)
}
