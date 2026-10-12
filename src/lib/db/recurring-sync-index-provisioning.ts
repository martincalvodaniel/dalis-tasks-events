import "server-only"

import {
  type IndexProvisioningPlan,
  type IndexProvisioningPorts,
  type IndexProvisioningResult,
  planIndexProvisioning,
  provisionIndexes,
} from "@/lib/db/index-provisioning-core"
import { selectRecurringSyncIndexSpecs } from "@/lib/db/mixed-sync-index-specs"
import { recurringSyncIndexReadinessSchema } from "@/schemas/recurring-sync-index-provisioning"

type IndexName = ReturnType<
  typeof recurringSyncIndexReadinessSchema.parse
>["missing"][number]
export type RecurringSyncIndexProvisioningPlan =
  IndexProvisioningPlan<IndexName>
export type RecurringSyncIndexProvisioningPorts = IndexProvisioningPorts
export type RecurringSyncIndexProvisioningResult =
  IndexProvisioningResult<IndexName>
const validationMessage = "Invalid recurring sync index readiness"

// Only registered definitions can be selected; connection ownership and environment authorization remain external.
export function planRecurringSyncIndexProvisioning(
  input: unknown
): RecurringSyncIndexProvisioningPlan {
  return planIndexProvisioning(
    input,
    recurringSyncIndexReadinessSchema,
    selectRecurringSyncIndexSpecs,
    validationMessage
  )
}

export function provisionRecurringSyncIndexes(
  ports: RecurringSyncIndexProvisioningPorts
): Promise<RecurringSyncIndexProvisioningResult> {
  return provisionIndexes(
    ports,
    recurringSyncIndexReadinessSchema,
    selectRecurringSyncIndexSpecs,
    validationMessage
  )
}
