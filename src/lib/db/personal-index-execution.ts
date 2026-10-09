import "server-only"

import { provisionMixedSyncIndexes } from "@/lib/db/mixed-sync-index-provisioning"
import { validatePersonalIndexTarget } from "@/lib/db/personal-index-target"
import { personalIndexExecutionSchema } from "@/schemas/personal-index-target"

type ProvisioningPorts = Parameters<typeof provisionMixedSyncIndexes>[0]
type ProvisioningResult = Awaited<ReturnType<typeof provisionMixedSyncIndexes>>

export interface PersonalIndexExecutionPorts {
  readConfiguredConnection(): unknown
  bootstrapOwnedConnection(): Promise<
    ProvisioningPorts & { databaseName: string }
  >
  closeOwnedConnection(): Promise<void>
}

export interface PersonalIndexExecutionResult {
  status: "ready" | "failed"
  phase:
    | "configuration"
    | "bootstrap"
    | "database"
    | "provision"
    | "complete"
    | "close"
  connection: "not_opened" | "closed" | "close_failed"
  provisioning: ProvisioningResult | null
}

// Required ports are private to the future standalone operator process, never RPC arguments.
export async function executePersonalIndexProvisioning(
  input: unknown,
  ports: PersonalIndexExecutionPorts
): Promise<PersonalIndexExecutionResult> {
  const result: PersonalIndexExecutionResult = {
    status: "failed",
    phase: "configuration",
    connection: "not_opened",
    provisioning: null,
  }
  const request = personalIndexExecutionSchema.safeParse(input)
  if (!request.success) return result
  try {
    validatePersonalIndexTarget(
      request.data.target,
      ports.readConfiguredConnection()
    )
  } catch {
    return result
  }
  result.phase = "bootstrap"
  try {
    const connection = await ports.bootstrapOwnedConnection()
    result.phase = "database"
    if (connection.databaseName !== request.data.target.databaseName)
      return result
    result.phase = "provision"
    result.provisioning = await provisionMixedSyncIndexes(connection)
    if (result.provisioning.status === "ready") {
      result.status = "ready"
      result.phase = "complete"
    }
  } catch {
    result.status = "failed"
  } finally {
    // Bootstrap may have opened a client before rejecting; always close that process's owned connection.
    try {
      await ports.closeOwnedConnection()
      result.connection = "closed"
    } catch {
      result.status = "failed"
      result.phase = "close"
      result.connection = "close_failed"
    }
  }
  return result
}
