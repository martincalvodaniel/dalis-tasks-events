import "server-only"

import { expect, test } from "bun:test"
import { executePlacementIndexProvisioning } from "@/lib/db/placement-index-execution"
import { placementSyncIndexNames } from "@/schemas/placement-sync-index-provisioning"

const configured = {
  databaseName: "owned-preview",
  mongodbAuthority: "owned-host:27017",
}
const request = {
  target: { ...configured, environment: "preproduction" },
  acknowledgeAutomaticBootstrap: true,
}
function fixture() {
  const missing = new Set<string>(placementSyncIndexNames)
  const calls: string[] = []
  const ports = {
    readConfiguredConnection: () => {
      calls.push("configuration")
      return configured
    },
    bootstrapOwnedConnection: async () => {
      calls.push("bootstrap")
      return {
        databaseName: configured.databaseName,
        readReadiness: async () => ({
          ready: !missing.size,
          missing: [...missing],
          incompatible: [],
        }),
        createIndex: async (spec: { options: { name: string } }) => {
          calls.push(spec.options.name)
          missing.delete(spec.options.name)
        },
      }
    },
    closeOwnedConnection: async () => {
      calls.push("close")
    },
  }
  return { ports, calls, missing }
}

test("placement lifecycle requires verified target and acknowledges bootstrap before opening", async () => {
  for (const invalid of [
    { ...request, acknowledgeAutomaticBootstrap: false },
    { ...request, target: { ...request.target, databaseName: "another-db" } },
    { ...request, target: { ...request.target, environment: "production" } },
  ]) {
    const value = fixture()
    expect(
      await executePlacementIndexProvisioning(invalid, value.ports)
    ).toEqual({
      status: "failed",
      phase: "configuration",
      connection: "not_opened",
      provisioning: null,
    })
    expect(value.calls).not.toContain("bootstrap")
    expect(value.calls).not.toContain("close")
  }
})

test("placement lifecycle reports ready only after all four indices and owned close", async () => {
  const value = fixture()
  expect(await executePlacementIndexProvisioning(request, value.ports)).toEqual(
    {
      status: "ready",
      phase: "complete",
      connection: "closed",
      provisioning: {
        status: "ready",
        created: [...placementSyncIndexNames],
        readiness: { ready: true, missing: [], incompatible: [] },
        error: null,
      },
    }
  )
  expect(value.calls).toEqual([
    "configuration",
    "bootstrap",
    ...placementSyncIndexNames,
    "close",
  ])
  value.calls.length = 0
  expect(
    (await executePlacementIndexProvisioning(request, value.ports)).provisioning
      ?.created
  ).toEqual([])
  expect(value.calls).toEqual(["configuration", "bootstrap", "close"])
})

test("actual database mismatch closes without invoking provisioning", async () => {
  const value = fixture()
  const bootstrap = value.ports.bootstrapOwnedConnection
  value.ports.bootstrapOwnedConnection = async () => ({
    ...(await bootstrap()),
    databaseName: "foreign-db",
  })
  expect(await executePlacementIndexProvisioning(request, value.ports)).toEqual(
    {
      status: "failed",
      phase: "database",
      connection: "closed",
      provisioning: null,
    }
  )
  expect(value.calls).toEqual(["configuration", "bootstrap", "close"])
})

test("bootstrap and close failures retain sanitized state and never imply successful completion", async () => {
  const value = fixture()
  value.ports.bootstrapOwnedConnection = async () => {
    value.calls.push("bootstrap")
    throw new Error("private connection details")
  }
  expect(await executePlacementIndexProvisioning(request, value.ports)).toEqual(
    {
      status: "failed",
      phase: "bootstrap",
      connection: "closed",
      provisioning: null,
    }
  )
  expect(value.calls).toEqual(["configuration", "bootstrap", "close"])
  const close = fixture()
  close.ports.closeOwnedConnection = async () => {
    throw new Error("private close details")
  }
  const result = await executePlacementIndexProvisioning(request, close.ports)
  expect(result.status).toBe("failed")
  expect(result.phase).toBe("close")
  expect(result.connection).toBe("close_failed")
  expect(result.provisioning?.created).toEqual([...placementSyncIndexNames])
  expect(JSON.stringify(result)).not.toContain("private")
})
