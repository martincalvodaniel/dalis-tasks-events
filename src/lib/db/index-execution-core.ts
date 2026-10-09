import "server-only"

import type {
  IndexProvisioningPorts,
  IndexProvisioningResult,
} from "@/lib/db/index-provisioning-core"
import { validatePersonalIndexTarget } from "@/lib/db/personal-index-target"
import { personalIndexExecutionSchema } from "@/schemas/personal-index-target"

export interface IndexExecutionPorts {
  readConfiguredConnection(): unknown
  bootstrapOwnedConnection(): Promise<
    IndexProvisioningPorts & { databaseName: string }
  >
  closeOwnedConnection(): Promise<void>
}

export interface IndexExecutionResult<IndexName extends string> {
  status: "ready" | "failed"
  phase:
    | "configuration"
    | "bootstrap"
    | "database"
    | "provision"
    | "complete"
    | "close"
  connection: "not_opened" | "closed" | "close_failed"
  provisioning: IndexProvisioningResult<IndexName> | null
}

// Required ports are private to the future standalone operator process, never RPC arguments.
export async function executeIndexProvisioning<IndexName extends string>(
  input: unknown,
  ports: IndexExecutionPorts,
  provision: (
    ports: IndexProvisioningPorts
  ) => Promise<IndexProvisioningResult<IndexName>>
): Promise<IndexExecutionResult<IndexName>> {
  const result: IndexExecutionResult<IndexName> = {
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
    result.provisioning = await provision(connection)
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
