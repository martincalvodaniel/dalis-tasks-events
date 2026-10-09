import { describe, expect, test } from "bun:test"
import { executePersonalIndexProvisioning } from "@/lib/db/personal-index-execution"
import { mixedSyncIndexNames } from "@/schemas/mixed-sync-index-provisioning"

const configured = {
  databaseName: "dalis-preview",
  mongodbAuthority: "host:27017",
}
const request = {
  target: { ...configured, environment: "preproduction" },
  acknowledgeAutomaticBootstrap: true,
}
function fixture(
  options: {
    databaseName?: string
    bootstrapFails?: boolean
    closeFails?: boolean
  } = {}
) {
  const calls: string[] = []
  return {
    calls,
    ports: {
      readConfiguredConnection() {
        calls.push("configuration")
        return configured
      },
      async bootstrapOwnedConnection() {
        calls.push("bootstrap")
        if (options.bootstrapFails)
          throw new Error("secret bootstrap diagnostics")
        return {
          databaseName: options.databaseName ?? configured.databaseName,
          async readReadiness() {
            calls.push("readiness")
            return { ready: true, missing: [], incompatible: [] }
          },
          async createIndex() {
            calls.push("create")
            throw new Error("Unexpected create")
          },
        }
      },
      async closeOwnedConnection() {
        calls.push("close")
        if (options.closeFails) throw new Error("secret close diagnostics")
      },
    },
  }
}
describe("personal index execution lifecycle", () => {
  test("retains a confirmed partial creation when both provisioning and close fail", async () => {
    const missing = new Set<string>(mixedSyncIndexNames)
    let creates = 0
    let closes = 0
    const result = await executePersonalIndexProvisioning(request, {
      readConfiguredConnection: () => configured,
      async bootstrapOwnedConnection() {
        return {
          databaseName: configured.databaseName,
          async readReadiness() {
            return {
              ready: missing.size === 0,
              missing: [...missing],
              incompatible: [],
            }
          },
          async createIndex(spec) {
            creates++
            if (creates === 2) throw new Error("secret creation diagnostics")
            missing.delete(spec.options.name)
          },
        }
      },
      async closeOwnedConnection() {
        closes++
        throw new Error("secret close diagnostics")
      },
    })
    expect(result.status).toBe("failed")
    expect(result.phase).toBe("close")
    expect(result.provisioning?.status).toBe("creation_failed")
    expect(result.provisioning?.created).toEqual([mixedSyncIndexNames[0]])
    expect(result.provisioning?.readiness?.missing).toEqual(
      mixedSyncIndexNames.slice(1)
    )
    expect(creates).toBe(2)
    expect(closes).toBe(1)
    expect(JSON.stringify(result)).not.toContain("secret")
  })
  test("rejects missing acknowledgement and mismatch before bootstrap or close", async () => {
    for (const input of [
      { ...request, acknowledgeAutomaticBootstrap: false },
      { ...request, target: { ...request.target, databaseName: "other" } },
    ]) {
      const own = fixture()
      const result = await executePersonalIndexProvisioning(input, own.ports)
      expect(result).toEqual({
        status: "failed",
        phase: "configuration",
        connection: "not_opened",
        provisioning: null,
      })
      expect(own.calls).not.toContain("bootstrap")
      expect(own.calls).not.toContain("close")
    }
  })
  test("closes after partial bootstrap failure and refuses a different real database", async () => {
    for (const [options, phase] of [
      [{ bootstrapFails: true }, "bootstrap"],
      [{ databaseName: "other" }, "database"],
    ] as const) {
      const own = fixture(options)
      const result = await executePersonalIndexProvisioning(request, own.ports)
      expect(result).toEqual({
        status: "failed",
        phase,
        connection: "closed",
        provisioning: null,
      })
      expect(own.calls).toEqual(["configuration", "bootstrap", "close"])
      expect(JSON.stringify(result)).not.toContain("secret")
    }
  })
  test("success requires close and a close failure retains the provisioning observation", async () => {
    const own = fixture()
    const success = await executePersonalIndexProvisioning(request, own.ports)
    expect(success.status).toBe("ready")
    expect(success.phase).toBe("complete")
    expect(own.calls).toEqual([
      "configuration",
      "bootstrap",
      "readiness",
      "close",
    ])
    const failing = fixture({ closeFails: true })
    const result = await executePersonalIndexProvisioning(
      request,
      failing.ports
    )
    expect(result.status).toBe("failed")
    expect(result.phase).toBe("close")
    expect(result.connection).toBe("close_failed")
    expect(result.provisioning).toEqual(success.provisioning)
    expect(JSON.stringify(result)).not.toContain("secret")
  })
})
