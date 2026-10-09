import "server-only"

import {
  executeIndexProvisioning,
  type IndexExecutionPorts,
  type IndexExecutionResult,
} from "@/lib/db/index-execution-core"
import { provisionMixedSyncIndexes } from "@/lib/db/mixed-sync-index-provisioning"

type IndexName = Awaited<
  ReturnType<typeof provisionMixedSyncIndexes>
>["created"][number]
export type PersonalIndexExecutionPorts = IndexExecutionPorts
export type PersonalIndexExecutionResult = IndexExecutionResult<IndexName>

export function executePersonalIndexProvisioning(
  input: unknown,
  ports: PersonalIndexExecutionPorts
): Promise<PersonalIndexExecutionResult> {
  return executeIndexProvisioning(input, ports, provisionMixedSyncIndexes)
}
