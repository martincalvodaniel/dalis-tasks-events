import "server-only"

import { expect, test } from "bun:test"
import { MongoServerError } from "mongodb"
import type { IndexSpec } from "@/lib/db/ensure-indexes"
import { provisionMixedSyncIndexes } from "@/lib/db/mixed-sync-index-provisioning"
import { selectPlacementSyncIndexSpecs } from "@/lib/db/mixed-sync-index-specs"
import {
  type PlacementSyncIndexProvisioningPorts,
  planPlacementSyncIndexProvisioning,
  provisionPlacementSyncIndexes,
} from "@/lib/db/placement-sync-index-provisioning"
import { placementSyncIndexNames } from "@/schemas/placement-sync-index-provisioning"

type Name = (typeof placementSyncIndexNames)[number]
const placementName = placementSyncIndexNames[3]
const privateDetails =
  "mongodb://private-user:private-password@private-host/private-db"
function readiness(
  missing: readonly Name[] = [],
  incompatible: readonly Name[] = []
) {
  return {
    ready: missing.length + incompatible.length === 0,
    missing: [...missing],
    incompatible: [...incompatible],
  }
}
function fixture(initial: readonly Name[] = placementSyncIndexNames) {
  const missing = new Set(initial)
  const created: IndexSpec[] = []
  let inspections = 0
  const ports: PlacementSyncIndexProvisioningPorts = {
    readReadiness: async () => {
      inspections++
      return readiness([...missing])
    },
    createIndex: async (spec) => {
      created.push(structuredClone(spec))
      missing.delete(spec.options.name as Name)
    },
  }
  return { ports, missing, created, inspections: () => inspections }
}

test("plans all four registered definitions and rejects incoherent or future inventories", () => {
  expect(
    planPlacementSyncIndexProvisioning(
      readiness([...placementSyncIndexNames].reverse())
    ).create
  ).toEqual([...placementSyncIndexNames])
  expect(
    planPlacementSyncIndexProvisioning(readiness([placementName])).create
  ).toEqual([placementName])
  for (const invalid of [
    { ...readiness(), ready: false },
    readiness([placementName, placementName]),
    readiness([placementName], [placementName]),
    { ...readiness(), extra: privateDetails },
    { ready: false, missing: [privateDetails], incompatible: [] },
  ])
    expect(() => planPlacementSyncIndexProvisioning(invalid)).toThrow(
      "Invalid placement sync index readiness"
    )
})

test("creates exact detached definitions with bounded inspection and becomes a no-op", async () => {
  const value = fixture()
  const create = value.ports.createIndex
  value.ports.createIndex = async (spec) => {
    await create(spec)
    spec.keys = { altered: 1 }
    spec.options.name = "Altered detached input"
  }
  expect(await provisionPlacementSyncIndexes(value.ports)).toEqual({
    status: "ready",
    created: [...placementSyncIndexNames],
    readiness: readiness(),
    error: null,
  })
  expect(value.created).toEqual(selectPlacementSyncIndexSpecs())
  expect(value.inspections()).toBe(5)
  expect(await provisionPlacementSyncIndexes(value.ports)).toEqual({
    status: "ready",
    created: [],
    readiness: readiness(),
    error: null,
  })
  expect(value.created).toHaveLength(4)
})

test("placement incompatibility blocks even missing base indexes before any creation", async () => {
  const value = fixture()
  value.ports.readReadiness = async () =>
    readiness([placementSyncIndexNames[0]], [placementName])
  expect(await provisionPlacementSyncIndexes(value.ports)).toEqual({
    status: "blocked",
    created: [],
    readiness: readiness([placementSyncIndexNames[0]], [placementName]),
    error: null,
  })
  expect(value.created).toEqual([])
  const mixed = fixture([placementName])
  expect((await provisionMixedSyncIndexes(mixed.ports)).error).toBe(
    "invalid_readiness"
  )
  expect(mixed.created).toEqual([])
})

test("duplicate data preserves a successful prefix and a retry creates only the missing placement", async () => {
  const value = fixture()
  const create = value.ports.createIndex
  value.ports.createIndex = async (spec) => {
    if (spec.options.name === placementName)
      throw new MongoServerError({ code: 11000, message: privateDetails })
    await create(spec)
  }
  const result = await provisionPlacementSyncIndexes(value.ports)
  expect(result).toEqual({
    status: "creation_failed",
    created: placementSyncIndexNames.slice(0, 3),
    readiness: readiness([placementName]),
    error: "duplicate_data",
  })
  expect(JSON.stringify(result)).not.toContain(privateDetails)
  value.ports.createIndex = create
  expect(await provisionPlacementSyncIndexes(value.ports)).toEqual({
    status: "ready",
    created: [placementName],
    readiness: readiness(),
    error: null,
  })
  expect(value.created).toEqual(selectPlacementSyncIndexSpecs())
})

test("lost creation response observes completion without claiming that failed call succeeded", async () => {
  const value = fixture([placementName])
  const create = value.ports.createIndex
  value.ports.createIndex = async (spec) => {
    await create(spec)
    throw new Error(privateDetails)
  }
  expect(await provisionPlacementSyncIndexes(value.ports)).toEqual({
    status: "creation_failed",
    created: [],
    readiness: readiness(),
    error: "creation_failed",
  })
  value.ports.createIndex = create
  expect(await provisionPlacementSyncIndexes(value.ports)).toEqual({
    status: "ready",
    created: [],
    readiness: readiness(),
    error: null,
  })
  expect(value.created).toHaveLength(1)
})

test("inspection failure and disappearing indexes stop without repair or leaking details", async () => {
  const failed = fixture()
  failed.ports.readReadiness = async () => {
    throw new Error(privateDetails)
  }
  expect(await provisionPlacementSyncIndexes(failed.ports)).toEqual({
    status: "inspection_failed",
    created: [],
    readiness: null,
    error: "inspection_unavailable",
  })
  expect(failed.created).toEqual([])
  const missing = fixture([placementName])
  missing.ports.createIndex = async (spec) => {
    missing.created.push(spec)
  }
  expect(await provisionPlacementSyncIndexes(missing.ports)).toEqual({
    status: "incomplete",
    created: [placementName],
    readiness: readiness([placementName]),
    error: null,
  })
  expect(missing.created).toHaveLength(1)
  expect(missing.inspections()).toBe(2)
})
