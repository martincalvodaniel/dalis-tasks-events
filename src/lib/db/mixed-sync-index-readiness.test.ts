import "server-only"

import { describe, expect, test } from "bun:test"
import { MongoServerError } from "mongodb"
import { COLLECTION_NAMES, type CollectionName } from "@/lib/db/collections"
import { INDEX_SPECS } from "@/lib/db/ensure-indexes"
import {
  inspectMixedSyncIndexReadiness,
  type MixedSyncIndexInspection,
} from "@/lib/db/mixed-sync-index-readiness"

const specs = INDEX_SPECS.filter(
  (spec) =>
    spec.provisioning === "explicit" &&
    (spec.collection === COLLECTION_NAMES.tags ||
      spec.collection === COLLECTION_NAMES.itemViews)
)
function inventory() {
  const result = new Map<CollectionName, Record<string, unknown>[]>()
  for (const spec of specs) {
    const name = spec.collection as CollectionName
    const rows = result.get(name) ?? []
    rows.push({
      v: 2,
      ns: "Private database namespace",
      key: structuredClone(spec.keys),
      ...structuredClone(spec.options),
    })
    result.set(name, rows)
  }
  return result
}
function inspection(rows = inventory()) {
  const calls: CollectionName[] = []
  const port: MixedSyncIndexInspection = {
    listIndexes: async (collection) => {
      calls.push(collection)
      return rows.get(collection) ?? []
    },
  }
  return { rows, calls, port }
}
const identityName = "tags_user_id_uidx"
const activeName = "tags_user_active_name_uidx"
const viewName = "item_views_user_item_uidx"
function index(rows: ReturnType<typeof inventory>, name: string) {
  const found = [...rows.values()].flat().find((row) => row.name === name)
  if (!found)
    throw new Error("Index fixture is missing its expected definition")
  return found
}

describe("mixed sync index readiness", () => {
  test("reads only the three central explicit definitions without altering them", async () => {
    const fixture = inspection()
    const before = JSON.stringify([...fixture.rows])
    expect(specs).toHaveLength(3)
    fixture.rows
      .get(COLLECTION_NAMES.tags)
      ?.push({ name: "_id_", key: { _id: 1 }, v: 2 })
    const observed = JSON.stringify([...fixture.rows])
    expect(await inspectMixedSyncIndexReadiness(fixture.port)).toEqual({
      ready: true,
      missing: [],
      incompatible: [],
    })
    expect(fixture.calls).toEqual([
      COLLECTION_NAMES.itemViews,
      COLLECTION_NAMES.tags,
    ])
    expect(JSON.stringify([...fixture.rows])).toBe(observed)
    expect(before).not.toBe(observed)
    expect(Object.keys(fixture.port)).toEqual(["listIndexes"])
  })
  test("reports only registered names when definitions or collections are absent", async () => {
    const fixture = inspection()
    fixture.rows.set(COLLECTION_NAMES.tags, [])
    expect(await inspectMixedSyncIndexReadiness(fixture.port)).toEqual({
      ready: false,
      missing: [identityName, activeName],
      incompatible: [],
    })
    const missing: MixedSyncIndexInspection = {
      listIndexes: async () => {
        throw new MongoServerError({ message: "Collection absent", code: 26 })
      },
    }
    expect(await inspectMixedSyncIndexReadiness(missing)).toEqual({
      ready: false,
      missing: [viewName, identityName, activeName],
      incompatible: [],
    })
    expect(
      JSON.stringify(await inspectMixedSyncIndexReadiness(missing))
    ).not.toContain("Private database")
  })
  test("classifies a wrong name as missing even if another index has matching keys", async () => {
    const fixture = inspection()
    index(fixture.rows, identityName).name = "Different name"
    expect(await inspectMixedSyncIndexReadiness(fixture.port)).toEqual({
      ready: false,
      missing: [identityName],
      incompatible: [],
    })
  })
  test("requires exact compound key order, directions and fields", async () => {
    for (const key of [
      { id: 1, userId: 1 },
      { userId: 1, id: -1 },
      { userId: 1 },
      { userId: 1, id: 1, deletedAt: 1 },
      { userId: "1", id: 1 },
      null,
      ["userId", "id"],
    ]) {
      const fixture = inspection()
      index(fixture.rows, identityName).key = key
      expect(await inspectMixedSyncIndexReadiness(fixture.port)).toEqual({
        ready: false,
        missing: [],
        incompatible: [identityName],
      })
    }
  })
  test("requires real uniqueness rather than truthy or absent options", async () => {
    for (const unique of [undefined, false, 1, "true", null]) {
      const fixture = inspection()
      index(fixture.rows, viewName).unique = unique
      expect(await inspectMixedSyncIndexReadiness(fixture.port)).toEqual({
        ready: false,
        missing: [],
        incompatible: [viewName],
      })
    }
  })
  test("compares the full partial filter and refuses non-JSON equivalents", async () => {
    for (const partialFilterExpression of [
      undefined,
      {},
      { deletedAt: { $exists: false } },
      { deletedAt: null, archived: false },
      { deletedAt: Number.NaN },
      { deletedAt: undefined },
      { deletedAt: new Date(0) },
    ]) {
      const fixture = inspection()
      index(fixture.rows, activeName).partialFilterExpression =
        partialFilterExpression
      expect(await inspectMixedSyncIndexReadiness(fixture.port)).toEqual({
        ready: false,
        missing: [],
        incompatible: [activeName],
      })
    }
    const unexpected = inspection()
    index(unexpected.rows, identityName).partialFilterExpression = {
      deletedAt: null,
    }
    expect(
      (await inspectMixedSyncIndexReadiness(unexpected.port)).incompatible
    ).toEqual([identityName])
  })
  test("accepts false default flags and harmless Mongo metadata", async () => {
    const fixture = inspection()
    for (const row of [...fixture.rows.values()].flat()) {
      row.sparse = false
      row.hidden = false
      row.background = true
      row.collation = undefined
      row.expireAfterSeconds = undefined
    }
    expect(await inspectMixedSyncIndexReadiness(fixture.port)).toEqual({
      ready: true,
      missing: [],
      incompatible: [],
    })
  })
  test("refuses sparse, hidden, collation, TTL and unknown invariant-affecting options", async () => {
    for (const options of [
      { sparse: true },
      { sparse: "false" },
      { hidden: true },
      { hidden: null },
      { collation: { locale: "simple" } },
      { collation: { locale: "es", strength: 2 } },
      { expireAfterSeconds: 0 },
      { expireAfterSeconds: 60 },
      { expireAfterSeconds: null },
      { prepareUnique: true },
      { wildcardProjection: { userId: 1 } },
    ]) {
      const fixture = inspection()
      Object.assign(index(fixture.rows, activeName), options)
      expect(await inspectMixedSyncIndexReadiness(fixture.port)).toEqual({
        ready: false,
        missing: [],
        incompatible: [activeName],
      })
    }
  })
  test("does not silently accept ambiguous duplicate named definitions", async () => {
    const fixture = inspection()
    fixture.rows
      .get(COLLECTION_NAMES.tags)
      ?.push(structuredClone(index(fixture.rows, identityName)))
    expect(await inspectMixedSyncIndexReadiness(fixture.port)).toEqual({
      ready: false,
      missing: [],
      incompatible: [identityName],
    })
  })
  test("propagates operational and unexpected errors instead of calling them missing", async () => {
    for (const error of [
      new MongoServerError({ message: "Not authorized", code: 13 }),
      new Error("Fixture connection unavailable"),
      { code: 26 },
    ]) {
      const port: MixedSyncIndexInspection = {
        listIndexes: async () => {
          throw error
        },
      }
      await expect(inspectMixedSyncIndexReadiness(port)).rejects.toBe(error)
    }
  })
})
