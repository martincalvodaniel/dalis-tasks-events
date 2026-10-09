import "server-only"

import {
  executeIndexProvisioning,
  type IndexExecutionPorts,
  type IndexExecutionResult,
} from "@/lib/db/index-execution-core"
import { provisionPlacementSyncIndexes } from "@/lib/db/placement-sync-index-provisioning"

type IndexName = Awaited<
  ReturnType<typeof provisionPlacementSyncIndexes>
>["created"][number]
export type PlacementIndexExecutionPorts = IndexExecutionPorts
export type PlacementIndexExecutionResult = IndexExecutionResult<IndexName>

export function executePlacementIndexProvisioning(
  input: unknown,
  ports: PlacementIndexExecutionPorts
): Promise<PlacementIndexExecutionResult> {
  return executeIndexProvisioning(input, ports, provisionPlacementSyncIndexes)
}
