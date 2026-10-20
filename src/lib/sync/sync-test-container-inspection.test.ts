import { expect, test } from "bun:test"
import { isConfirmedMissingSyncTestContainer } from "@/lib/sync/sync-test-container-inspection"

const name = `dalis-sync-test-${crypto.randomUUID()}`
test("only an exact absence response for the owned generated container is accepted", () => {
  for (const errors of [
    `Error: No such object: ${name}`,
    `Error response from daemon: No such container: ${name}`,
  ])
    expect(
      isConfirmedMissingSyncTestContainer(name, {
        exitCode: 1,
        output: "[]",
        errors,
      })
    ).toBe(true)
})
test("daemon timeouts, permissions and malformed output never prove absence", () => {
  for (const result of [
    { exitCode: 137, output: "", errors: "" },
    { exitCode: 1, output: "", errors: "Cannot connect to the Docker daemon" },
    { exitCode: 1, output: "", errors: "Permission denied" },
    { exitCode: 0, output: "[]", errors: `Error: No such object: ${name}` },
    { exitCode: null, output: "", errors: "" },
    {
      exitCode: 1,
      output: "unexpected",
      errors: `Error: No such object: ${name}`,
    },
  ])
    expect(isConfirmedMissingSyncTestContainer(name, result)).toBe(false)
})
test("a foreign name or additional diagnostic text cannot be mistaken for owned absence", () => {
  expect(
    isConfirmedMissingSyncTestContainer(name, {
      exitCode: 1,
      output: "[]",
      errors: `Error: No such object: dalis-sync-test-${crypto.randomUUID()}`,
    })
  ).toBe(false)
  expect(
    isConfirmedMissingSyncTestContainer(name, {
      exitCode: 1,
      output: "[]",
      errors: `Error: No such object: ${name}\nPermission denied`,
    })
  ).toBe(false)
  expect(
    isConfirmedMissingSyncTestContainer("production", {
      exitCode: 1,
      output: "[]",
      errors: "Error: No such object: production",
    })
  ).toBe(false)
})
