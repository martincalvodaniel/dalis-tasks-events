import "server-only"

import { MongoServerError } from "mongodb"
import type { IndexSpec } from "@/lib/db/ensure-indexes"
import { selectMixedSyncIndexSpecs } from "@/lib/db/mixed-sync-index-specs"
import { mixedSyncIndexReadinessSchema } from "@/schemas/mixed-sync-index-provisioning"

type Readiness = ReturnType<typeof mixedSyncIndexReadinessSchema.parse>
type IndexName = Readiness["missing"][number]
type InspectionError = "inspection_unavailable" | "invalid_readiness"
type CreationError =
  | "duplicate_data"
  | "definition_conflict"
  | "creation_failed"

export interface MixedSyncIndexProvisioningPlan {
  status: "ready" | "create_missing" | "blocked"
  readiness: Readiness
  create: IndexName[]
}

export interface MixedSyncIndexProvisioningPorts {
  readReadiness(): Promise<unknown>
  createIndex(spec: IndexSpec): Promise<unknown>
}

export interface MixedSyncIndexProvisioningResult {
  status:
    | "ready"
    | "blocked"
    | "incomplete"
    | "inspection_failed"
    | "creation_failed"
  // Only calls that resolved successfully appear here; a rejected call may still have taken effect.
  created: IndexName[]
  readiness: Readiness | null
  error: InspectionError | CreationError | null
}

export function planMixedSyncIndexProvisioning(
  input: unknown
): MixedSyncIndexProvisioningPlan {
  const parsed = mixedSyncIndexReadinessSchema.safeParse(input)
  if (!parsed.success) throw new Error("Invalid mixed sync index readiness")
  const readiness = parsed.data
  const status = readiness.incompatible.length
    ? "blocked"
    : readiness.ready
      ? "ready"
      : "create_missing"
  return {
    status,
    readiness,
    create:
      status === "create_missing"
        ? selectMixedSyncIndexSpecs()
            .map((spec) => spec.options.name as IndexName)
            .filter((name) => readiness.missing.includes(name))
        : [],
  }
}

function creationError(error: unknown): CreationError {
  if (error instanceof MongoServerError) {
    if (error.code === 11000) return "duplicate_data"
    if (error.code === 85 || error.code === 86) return "definition_conflict"
  }
  return "creation_failed"
}

async function inspect(
  ports: MixedSyncIndexProvisioningPorts
): Promise<
  | { readiness: Readiness; error: null }
  | { readiness: null; error: InspectionError }
> {
  try {
    const parsed = mixedSyncIndexReadinessSchema.safeParse(
      await ports.readReadiness()
    )
    return parsed.success
      ? { readiness: parsed.data, error: null }
      : { readiness: null, error: "invalid_readiness" }
  } catch {
    return { readiness: null, error: "inspection_unavailable" }
  }
}

// This operation has no database connection or default caller. Environment authorization remains external.
export async function provisionMixedSyncIndexes(
  ports: MixedSyncIndexProvisioningPorts
): Promise<MixedSyncIndexProvisioningResult> {
  const specs = selectMixedSyncIndexSpecs()
  const created: IndexName[] = []
  // Reinspect before every create and after the last one; never repair drift by looping indefinitely.
  for (let attempt = 0; attempt <= specs.length; attempt++) {
    const observed = await inspect(ports)
    if (observed.error)
      return {
        status: "inspection_failed",
        created,
        readiness: null,
        error: observed.error,
      }
    const plan = planMixedSyncIndexProvisioning(observed.readiness)
    if (plan.status === "ready" || plan.status === "blocked")
      return {
        status: plan.status,
        created,
        readiness: plan.readiness,
        error: null,
      }
    if (
      attempt === specs.length ||
      plan.create.some((name) => created.includes(name))
    )
      return {
        status: "incomplete",
        created,
        readiness: plan.readiness,
        error: null,
      }
    const name = plan.create[0]
    const spec = specs.find((candidate) => candidate.options.name === name)
    if (!spec)
      throw new Error("Provisioning lost its registered index identity")
    try {
      await ports.createIndex(structuredClone(spec))
      created.push(name)
    } catch (error) {
      // Creation is not atomic across indexes. Observe partial state without undoing or disclosing errors.
      const after = await inspect(ports)
      return {
        status: "creation_failed",
        created,
        readiness: after.readiness,
        error: creationError(error),
      }
    }
  }
  throw new Error("Index provisioning exceeded its bounded inspection loop")
}
