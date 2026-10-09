import "server-only"

import {
  type IndexProvisioningPlan,
  type IndexProvisioningPorts,
  type IndexProvisioningResult,
  planIndexProvisioning,
  provisionIndexes,
} from "@/lib/db/index-provisioning-core"
import { selectMixedSyncIndexSpecs } from "@/lib/db/mixed-sync-index-specs"
import { mixedSyncIndexReadinessSchema } from "@/schemas/mixed-sync-index-provisioning"

type IndexName = ReturnType<
  typeof mixedSyncIndexReadinessSchema.parse
>["missing"][number]
export type MixedSyncIndexProvisioningPlan = IndexProvisioningPlan<IndexName>
export type MixedSyncIndexProvisioningPorts = IndexProvisioningPorts
export type MixedSyncIndexProvisioningResult =
  IndexProvisioningResult<IndexName>
const validationMessage = "Invalid mixed sync index readiness"

// Only registered definitions can be selected; connection ownership and environment authorization remain external.
export function planMixedSyncIndexProvisioning(
  input: unknown
): MixedSyncIndexProvisioningPlan {
  return planIndexProvisioning(
    input,
    mixedSyncIndexReadinessSchema,
    selectMixedSyncIndexSpecs,
    validationMessage
  )
}

export function provisionMixedSyncIndexes(
  ports: MixedSyncIndexProvisioningPorts
): Promise<MixedSyncIndexProvisioningResult> {
  return provisionIndexes(
    ports,
    mixedSyncIndexReadinessSchema,
    selectMixedSyncIndexSpecs,
    validationMessage
  )
}
