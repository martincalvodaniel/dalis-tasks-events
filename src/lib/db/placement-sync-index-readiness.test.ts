import "server-only"

import { expect, test } from "bun:test"
import { MongoServerError } from "mongodb"
import { COLLECTION_NAMES, type CollectionName } from "@/lib/db/collections"
import { automaticIndexSpecs, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import {
  inspectMixedSyncIndexReadiness,
  inspectPlacementSyncIndexReadiness,
  type MixedSyncIndexInspection,
} from "@/lib/db/mixed-sync-index-readiness"
import {
  selectMixedSyncIndexSpecs,
  selectPlacementSyncIndexSpecs,
} from "@/lib/db/mixed-sync-index-specs"

const placementName = "task_placements_user_scope_date_occurrence_uidx"
const expectedNames = [
  "item_views_user_item_uidx",
  "tags_user_id_uidx",
  "tags_user_active_name_uidx",
  placementName,
]
function fixture() {
  const rows = new Map<CollectionName, Record<string, unknown>[]>()
  for (const spec of selectPlacementSyncIndexSpecs()) {
    const collection = spec.collection as CollectionName
    const indexes = rows.get(collection) ?? []
    indexes.push({
      v: 2,
      key: structuredClone(spec.keys),
      ...structuredClone(spec.options),
    })
    rows.set(collection, indexes)
  }
  const calls: CollectionName[] = []
  const port: MixedSyncIndexInspection = {
    listIndexes: async (collection) => {
      calls.push(collection)
      return rows.get(collection) ?? []
    },
  }
  const placement = rows.get(COLLECTION_NAMES.taskPlacements)?.[0]
  if (!placement) throw new Error("Expected placement identity index fixture")
  return { rows, calls, port, placement }
}

test("placement selection adds one detached registered identity definition while leaving automatic and mixed selections unchanged", () => {
  const before = structuredClone(INDEX_SPECS)
  const automatic = structuredClone(automaticIndexSpecs())
  const mixed = structuredClone(selectMixedSyncIndexSpecs())
  const selected = selectPlacementSyncIndexSpecs()
  expect(selected.map((spec) => spec.options.name)).toEqual(expectedNames)
  expect(selected.slice(0, 3)).toEqual(mixed)
  expect(selected.at(-1)).toEqual({
    collection: COLLECTION_NAMES.taskPlacements,
    keys: { userId: 1, scope: 1, date: 1, occurrenceId: 1 },
    options: { name: placementName, unique: true },
    provisioning: "explicit",
  })
  for (const spec of selected) {
    const central = INDEX_SPECS.find(
      (entry) => entry.options.name === spec.options.name
    )
    if (!central) throw new Error("Expected registered index definition")
    expect(spec).toEqual(central)
    expect(spec).not.toBe(central)
    expect(spec.provisioning).toBe("explicit")
  }
  selected[3].options.unique = false
  selected[3].keys = { occurrenceId: 1 }
  const filter = selected[2].options.partialFilterExpression
  if (!filter) throw new Error("Expected cloned active category filter")
  filter.deletedAt = "Changed fixture"
  expect(INDEX_SPECS).toEqual(before)
  expect(selectMixedSyncIndexSpecs()).toEqual(mixed)
  expect(automaticIndexSpecs()).toEqual(automatic)
  expect(automatic.some((spec) => spec.options.name === placementName)).toBe(
    false
  )
  const placement = before.find((spec) => spec.options.name === placementName)
  if (!placement) throw new Error("Expected central placement definition")
  expect(selectPlacementSyncIndexSpecs()).toEqual([...mixed, placement])
})

test("mixed readiness remains ready without placements while placement readiness requires all four definitions", async () => {
  const value = fixture()
  value.rows.delete(COLLECTION_NAMES.taskPlacements)
  const before = structuredClone([...value.rows])
  expect(await inspectMixedSyncIndexReadiness(value.port)).toEqual({
    ready: true,
    missing: [],
    incompatible: [],
  })
  expect(value.calls).toEqual([
    COLLECTION_NAMES.itemViews,
    COLLECTION_NAMES.tags,
  ])
  value.calls.length = 0
  expect(await inspectPlacementSyncIndexReadiness(value.port)).toEqual({
    ready: false,
    missing: [placementName],
    incompatible: [],
  })
  expect(value.calls).toEqual([
    COLLECTION_NAMES.itemViews,
    COLLECTION_NAMES.tags,
    COLLECTION_NAMES.taskPlacements,
  ])
  expect([...value.rows]).toEqual(before)
  expect(Object.keys(value.port)).toEqual(["listIndexes"])
  const empty: MixedSyncIndexInspection = {
    listIndexes: async () => {
      throw new MongoServerError({
        message: "Owned collection absent",
        code: 26,
      })
    },
  }
  expect(await inspectPlacementSyncIndexReadiness(empty)).toEqual({
    ready: false,
    missing: expectedNames,
    incompatible: [],
  })
})

test("placement readiness accepts the registered definition and harmless Mongo metadata without modifying the inventory", async () => {
  const value = fixture()
  Object.assign(value.placement, {
    ns: "Private namespace",
    background: true,
    sparse: false,
    hidden: false,
  })
  value.rows
    .get(COLLECTION_NAMES.taskPlacements)
    ?.push({ name: "_id_", key: { _id: 1 }, v: 2 })
  const before = structuredClone([...value.rows])
  expect(await inspectPlacementSyncIndexReadiness(value.port)).toEqual({
    ready: true,
    missing: [],
    incompatible: [],
  })
  expect(value.calls).toEqual([
    COLLECTION_NAMES.itemViews,
    COLLECTION_NAMES.tags,
    COLLECTION_NAMES.taskPlacements,
  ])
  expect([...value.rows]).toEqual(before)
})

test("placement identity requires exact compound key order, direction, uniqueness and full index options", async () => {
  for (const invalid of [
    { key: { userId: 1, date: 1, scope: 1, occurrenceId: 1 } },
    { key: { userId: 1, scope: 1, date: -1, occurrenceId: 1 } },
    { key: { userId: 1, scope: 1, date: 1 } },
    { key: { userId: 1, scope: 1, date: 1, occurrenceId: 1, revision: 1 } },
    { key: null },
    { key: ["userId", "scope", "date", "occurrenceId"] },
    { unique: false },
    { unique: undefined },
    { unique: "true" },
    { partialFilterExpression: { deletedAt: null } },
    { sparse: true },
    { hidden: true },
    { collation: { locale: "simple" } },
    { expireAfterSeconds: 0 },
    { prepareUnique: true },
  ]) {
    const value = fixture()
    Object.assign(value.placement, invalid)
    expect(await inspectPlacementSyncIndexReadiness(value.port)).toEqual({
      ready: false,
      missing: [],
      incompatible: [placementName],
    })
    expect(await inspectMixedSyncIndexReadiness(value.port)).toEqual({
      ready: true,
      missing: [],
      incompatible: [],
    })
  }
})

test("wrong or ambiguous placement names are not accepted as an identity index and base incompatibility still blocks readiness", async () => {
  const renamed = fixture()
  renamed.placement.name = "Different placement identity"
  expect(await inspectPlacementSyncIndexReadiness(renamed.port)).toEqual({
    ready: false,
    missing: [placementName],
    incompatible: [],
  })
  const duplicate = fixture()
  duplicate.rows
    .get(COLLECTION_NAMES.taskPlacements)
    ?.push(structuredClone(duplicate.placement))
  expect(await inspectPlacementSyncIndexReadiness(duplicate.port)).toEqual({
    ready: false,
    missing: [],
    incompatible: [placementName],
  })
  const base = fixture()
  const view = base.rows.get(COLLECTION_NAMES.itemViews)?.[0]
  if (!view) throw new Error("Expected view identity fixture")
  view.unique = false
  expect(await inspectPlacementSyncIndexReadiness(base.port)).toEqual({
    ready: false,
    missing: [],
    incompatible: [expectedNames[0]],
  })
})

test("placement readiness propagates permission and operational failures without reporting false missing indexes", async () => {
  for (const error of [
    new MongoServerError({ message: "Denied", code: 13 }),
    new Error("Owned connection unavailable"),
    { code: 26 },
  ]) {
    const port: MixedSyncIndexInspection = {
      listIndexes: async () => {
        throw error
      },
    }
    await expect(inspectPlacementSyncIndexReadiness(port)).rejects.toBe(error)
  }
})
