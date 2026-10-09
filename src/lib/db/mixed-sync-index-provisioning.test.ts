import "server-only"

import { describe, expect, test } from "bun:test"
import { MongoServerError } from "mongodb"
import {
  automaticIndexSpecs,
  INDEX_SPECS,
  type IndexSpec,
} from "@/lib/db/ensure-indexes"
import {
  type MixedSyncIndexProvisioningPorts,
  planMixedSyncIndexProvisioning,
  provisionMixedSyncIndexes,
} from "@/lib/db/mixed-sync-index-provisioning"
import { selectMixedSyncIndexSpecs } from "@/lib/db/mixed-sync-index-specs"
import { mixedSyncIndexNames } from "@/schemas/mixed-sync-index-provisioning"

type IndexName = (typeof mixedSyncIndexNames)[number]
const [viewName, identityName, activeName] = mixedSyncIndexNames
const privateDetails =
  "mongodb://private-user:private-password@private-host/private-db; dupKey private-email"

function readiness(
  missing: readonly IndexName[] = [],
  incompatible: readonly IndexName[] = []
) {
  return {
    ready: missing.length + incompatible.length === 0,
    missing: [...missing],
    incompatible: [...incompatible],
  }
}

function fixture(initial: readonly IndexName[] = mixedSyncIndexNames) {
  const missing = new Set(initial)
  const created: IndexSpec[] = []
  let inspections = 0
  const ports: MixedSyncIndexProvisioningPorts = {
    readReadiness: async () => {
      inspections++
      return readiness([...missing])
    },
    createIndex: async (spec) => {
      created.push(structuredClone(spec))
      missing.delete(spec.options.name as IndexName)
      return spec.options.name
    },
  }
  return { ports, missing, created, inspections: () => inspections }
}

describe("explicit mixed sync index provisioning ports", () => {
  test("selects exactly three detached registered definitions without changing automatic bootstrap", () => {
    const before = structuredClone(INDEX_SPECS)
    const selected = selectMixedSyncIndexSpecs()
    expect(selected.map((spec) => spec.options.name)).toEqual([
      ...mixedSyncIndexNames,
    ])
    expect(selected.map((spec) => spec.collection)).toEqual([
      "item_views",
      "tags",
      "tags",
    ])
    expect(selected.every((spec) => spec.provisioning === "explicit")).toBe(
      true
    )
    expect(selected).toEqual(
      INDEX_SPECS.filter((spec) =>
        mixedSyncIndexNames.some((name) => name === spec.options.name)
      )
    )
    const partial = selected[2].options.partialFilterExpression
    if (!partial) throw new Error("Fixture requires its partial index")
    partial.deletedAt = "changed fixture value"
    selected[0].options.unique = false
    selected[1].keys = { changed: 1 }
    expect(INDEX_SPECS).toEqual(before)
    expect(selectMixedSyncIndexSpecs()).toEqual(
      before.filter((spec) =>
        mixedSyncIndexNames.some((name) => name === spec.options.name)
      )
    )
    expect(selected.some((spec) => spec.collection === "task_placements")).toBe(
      false
    )
    expect(automaticIndexSpecs()).toHaveLength(9)
    expect(
      automaticIndexSpecs().some((spec) => spec.provisioning === "explicit")
    ).toBe(false)
  })

  test("plans only registered missing definitions and rejects incoherent or arbitrary snapshots", () => {
    const input = readiness([activeName, viewName])
    const before = structuredClone(input)
    const plan = planMixedSyncIndexProvisioning(input)
    expect(plan.status).toBe("create_missing")
    expect(plan.create).toEqual([viewName, activeName])
    plan.readiness.missing.pop()
    expect(input).toEqual(before)
    expect(planMixedSyncIndexProvisioning(readiness()).status).toBe("ready")
    expect(
      planMixedSyncIndexProvisioning(readiness([viewName], [identityName]))
    ).toEqual({
      status: "blocked",
      readiness: readiness([viewName], [identityName]),
      create: [],
    })
    for (const invalid of [
      { ...readiness(), ready: false },
      { ...readiness([viewName]), ready: true },
      readiness([viewName, viewName]),
      readiness([viewName], [viewName]),
      { ready: false, missing: [privateDetails], incompatible: [] },
      { ...readiness(), extra: privateDetails },
      { ...readiness(), missing: null },
      { ...readiness(), ready: "true" },
    ])
      expect(() => planMixedSyncIndexProvisioning(invalid)).toThrow(
        "Invalid mixed sync index readiness"
      )
  })

  test("ready and incompatible inventories create nothing and do not expose a deletion port", async () => {
    const ready = fixture([])
    expect(await provisionMixedSyncIndexes(ready.ports)).toEqual({
      status: "ready",
      created: [],
      readiness: readiness(),
      error: null,
    })
    expect(ready.created).toEqual([])
    const blocked = fixture()
    blocked.ports.readReadiness = async () =>
      readiness([viewName, activeName], [identityName])
    expect(await provisionMixedSyncIndexes(blocked.ports)).toEqual({
      status: "blocked",
      created: [],
      readiness: readiness([viewName, activeName], [identityName]),
      error: null,
    })
    expect(blocked.created).toEqual([])
    expect(Object.keys(blocked.ports)).toEqual(["readReadiness", "createIndex"])
  })

  test("reinspects every create, skips concurrent provisioning and passes only detached exact definitions", async () => {
    const value = fixture()
    const read = value.ports.readReadiness
    value.ports.readReadiness = async () => {
      if (value.created.length === 1) value.missing.delete(identityName)
      return read()
    }
    const create = value.ports.createIndex
    value.ports.createIndex = async (spec) => {
      const result = await create(spec)
      spec.options.name = "Changed detached port input"
      spec.options.unique = false
      return result
    }
    expect(await provisionMixedSyncIndexes(value.ports)).toEqual({
      status: "ready",
      created: [viewName, activeName],
      readiness: readiness(),
      error: null,
    })
    expect(value.created).toEqual(
      selectMixedSyncIndexSpecs().filter(
        (spec) => spec.options.name !== identityName
      )
    )
    expect(value.inspections()).toBe(3)
  })

  test("duplicate data failure preserves the successful prefix and a later retry creates only what is missing", async () => {
    const value = fixture()
    const create = value.ports.createIndex
    value.ports.createIndex = async (spec) => {
      if (spec.options.name === activeName)
        throw new MongoServerError({
          code: 11000,
          message: privateDetails,
          keyValue: { email: privateDetails },
        })
      return create(spec)
    }
    const failed = await provisionMixedSyncIndexes(value.ports)
    expect(failed).toEqual({
      status: "creation_failed",
      created: [viewName, identityName],
      readiness: readiness([activeName]),
      error: "duplicate_data",
    })
    expect(JSON.stringify(failed)).not.toContain(privateDetails)
    value.ports.createIndex = create
    expect(await provisionMixedSyncIndexes(value.ports)).toEqual({
      status: "ready",
      created: [activeName],
      readiness: readiness(),
      error: null,
    })
    expect(value.created).toEqual(selectMixedSyncIndexSpecs())
  })

  test("corrupt and unreadable observations fail closed initially and after a successful create", async () => {
    for (const phase of ["initial", "after_create"] as const)
      for (const invalid of ["corrupt", "unavailable"] as const) {
        const value = fixture()
        const read = value.ports.readReadiness
        value.ports.readReadiness = async () => {
          if (phase === "initial" || value.created.length) {
            if (invalid === "unavailable") throw new Error(privateDetails)
            return { ...readiness([identityName]), missing: [privateDetails] }
          }
          return read()
        }
        const result = await provisionMixedSyncIndexes(value.ports)
        expect(result).toEqual({
          status: "inspection_failed",
          created: phase === "initial" ? [] : [viewName],
          readiness: null,
          error:
            invalid === "corrupt"
              ? "invalid_readiness"
              : "inspection_unavailable",
        })
        expect(value.created).toHaveLength(phase === "initial" ? 0 : 1)
        expect(JSON.stringify(result)).not.toContain(privateDetails)
      }
  })

  test("creation errors disclose only finite categories and reinspect even when the rejected call took effect", async () => {
    for (const error of [
      new MongoServerError({ code: 85, message: privateDetails }),
      new MongoServerError({ code: 86, message: privateDetails }),
      new Error(privateDetails),
      { code: 11000, message: privateDetails },
    ]) {
      const value = fixture([viewName])
      value.ports.createIndex = async () => {
        value.missing.delete(viewName)
        throw error
      }
      const result = await provisionMixedSyncIndexes(value.ports)
      expect(result).toEqual({
        status: "creation_failed",
        created: [],
        readiness: readiness(),
        error:
          error instanceof MongoServerError
            ? "definition_conflict"
            : "creation_failed",
      })
      expect(value.inspections()).toBe(2)
      expect(JSON.stringify(result)).not.toContain(privateDetails)
    }
    const unreadable = fixture([viewName])
    let failed = false
    unreadable.ports.createIndex = async () => {
      failed = true
      throw new Error(privateDetails)
    }
    unreadable.ports.readReadiness = async () => {
      if (failed) throw new Error(privateDetails)
      return readiness([viewName])
    }
    expect(await provisionMixedSyncIndexes(unreadable.ports)).toEqual({
      status: "creation_failed",
      created: [],
      readiness: null,
      error: "creation_failed",
    })
  })

  test("incompatible drift stops further creation and a removed successful index is not recreated", async () => {
    for (const drift of ["incompatible", "removed"] as const) {
      const value = fixture()
      const read = value.ports.readReadiness
      value.ports.readReadiness = async () => {
        if (!value.created.length) return read()
        return drift === "incompatible"
          ? readiness([activeName], [identityName])
          : readiness(mixedSyncIndexNames)
      }
      expect(await provisionMixedSyncIndexes(value.ports)).toEqual({
        status: drift === "incompatible" ? "blocked" : "incomplete",
        created: [viewName],
        error: null,
        readiness:
          drift === "incompatible"
            ? readiness([activeName], [identityName])
            : readiness(mixedSyncIndexNames),
      })
      expect(value.created).toHaveLength(1)
    }
  })

  test("the final observation is required after all three creates and does not infer readiness from success", async () => {
    const complete = fixture()
    expect(await provisionMixedSyncIndexes(complete.ports)).toEqual({
      status: "ready",
      created: [...mixedSyncIndexNames],
      readiness: readiness(),
      error: null,
    })
    expect(complete.inspections()).toBe(4)
    const value = fixture()
    const read = value.ports.readReadiness
    value.ports.readReadiness = async () => {
      if (value.created.length === 3) throw new Error(privateDetails)
      return read()
    }
    expect(await provisionMixedSyncIndexes(value.ports)).toEqual({
      status: "inspection_failed",
      created: [...mixedSyncIndexNames],
      readiness: null,
      error: "inspection_unavailable",
    })
    expect(value.created).toEqual(selectMixedSyncIndexSpecs())
  })
})
