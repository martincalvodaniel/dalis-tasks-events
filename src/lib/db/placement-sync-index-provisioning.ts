import "server-only"

import {
  type IndexProvisioningPlan,
  type IndexProvisioningPorts,
  type IndexProvisioningResult,
  planIndexProvisioning,
  provisionIndexes,
} from "@/lib/db/index-provisioning-core"
import { selectPlacementSyncIndexSpecs } from "@/lib/db/mixed-sync-index-specs"
import { placementSyncIndexReadinessSchema } from "@/schemas/placement-sync-index-provisioning"

type IndexName = ReturnType<
  typeof placementSyncIndexReadinessSchema.parse
>["missing"][number]
export type PlacementSyncIndexProvisioningPlan =
  IndexProvisioningPlan<IndexName>
export type PlacementSyncIndexProvisioningPorts = IndexProvisioningPorts
export type PlacementSyncIndexProvisioningResult =
  IndexProvisioningResult<IndexName>
const validationMessage = "Invalid placement sync index readiness"

// Only registered definitions can be selected; connection ownership and environment authorization remain external.
export function planPlacementSyncIndexProvisioning(
  input: unknown
): PlacementSyncIndexProvisioningPlan {
  return planIndexProvisioning(
    input,
    placementSyncIndexReadinessSchema,
    selectPlacementSyncIndexSpecs,
    validationMessage
  )
}

export function provisionPlacementSyncIndexes(
  ports: PlacementSyncIndexProvisioningPorts
): Promise<PlacementSyncIndexProvisioningResult> {
  return provisionIndexes(
    ports,
    placementSyncIndexReadinessSchema,
    selectPlacementSyncIndexSpecs,
    validationMessage
  )
}
