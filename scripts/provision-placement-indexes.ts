import type { PlacementIndexExecutionResult } from "@/lib/db/placement-index-execution"
import { parsePersonalIndexCliArguments } from "@/schemas/personal-index-cli"

// Invoke in its own process with Bun --no-env-file --conditions=react-server.
async function main(): Promise<void> {
  let input: ReturnType<typeof parsePersonalIndexCliArguments>
  try {
    input = parsePersonalIndexCliArguments(process.argv.slice(2))
  } catch {
    const result: PlacementIndexExecutionResult = {
      status: "failed",
      phase: "configuration",
      connection: "not_opened",
      provisioning: null,
    }
    console.log(JSON.stringify(result))
    process.exitCode = 1
    return
  }
  try {
    const { runPlacementIndexProvisioning } = await import(
      "@/lib/db/placement-index-operator"
    )
    const result = await runPlacementIndexProvisioning(input)
    console.log(JSON.stringify(result))
    process.exitCode =
      result.status === "ready" && result.connection === "closed" ? 0 : 1
  } catch {
    // An unexpected failure cannot establish a lifecycle receipt.
    console.error("Placement index provisioning operator failed")
    process.exitCode = 1
  }
}

await main()
