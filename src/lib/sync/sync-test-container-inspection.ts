import { entityIdSchema } from "@/schemas/primitives"

// Only an exact negative response for this generated name proves absence; timeouts never do.
export function isConfirmedMissingSyncTestContainer(
  name: string,
  result: { exitCode: number | null; output: string; errors: string }
): boolean {
  const prefix = "dalis-sync-test-"
  if (
    !name.startsWith(prefix) ||
    !entityIdSchema.safeParse(name.slice(prefix.length)).success
  )
    return false
  return (
    result.exitCode === 1 &&
    (result.output === "[]" || result.output === "") &&
    [
      `Error: No such object: ${name}`,
      `Error response from daemon: No such container: ${name}`,
    ].includes(result.errors.trim())
  )
}
