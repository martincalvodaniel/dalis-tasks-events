import "server-only"

import { expect, test } from "bun:test"
import { MongoServerError } from "mongodb"
import { COLLECTION_NAMES, type CollectionName } from "@/lib/db/collections"
import {
  inspectPlacementSyncIndexReadiness,
  inspectRecurringSyncIndexReadiness,
} from "@/lib/db/mixed-sync-index-readiness"
import { selectRecurringSyncIndexSpecs } from "@/lib/db/mixed-sync-index-specs"

function fixture() {
  const rows = new Map<CollectionName, Record<string, unknown>[]>()
  for (const spec of selectRecurringSyncIndexSpecs()) {
    const name = spec.collection as CollectionName
    rows.set(name, [
      ...(rows.get(name) ?? []),
      { key: structuredClone(spec.keys), ...structuredClone(spec.options) },
    ])
  }
  const calls: string[] = []
  return {
    rows,
    calls,
    port: {
      listIndexes: async (name: CollectionName) => {
        calls.push(name)
        return rows.get(name) ?? []
      },
    },
  }
}
const name = "plan_occurrences_user_series_slot_uidx"
test("future readiness inspects five exact registered indexes without widening active inspection", async () => {
  const value = fixture(),
    before = structuredClone([...value.rows])
  expect(selectRecurringSyncIndexSpecs()).toHaveLength(5)
  expect(await inspectRecurringSyncIndexReadiness(value.port)).toEqual({
    ready: true,
    missing: [],
    incompatible: [],
  })
  expect(value.calls).toContain(COLLECTION_NAMES.planOccurrences)
  expect([...value.rows]).toEqual(before)
  value.calls.length = 0
  expect((await inspectPlacementSyncIndexReadiness(value.port)).ready).toBe(
    true
  )
  expect(value.calls).not.toContain(COLLECTION_NAMES.planOccurrences)
})
test("missing namespace and incompatible appearance identity never appear ready", async () => {
  const value = fixture()
  value.rows.delete(COLLECTION_NAMES.planOccurrences)
  expect(await inspectRecurringSyncIndexReadiness(value.port)).toEqual({
    ready: false,
    missing: [name],
    incompatible: [],
  })
  const inspection = {
    listIndexes: async (collection: CollectionName) => {
      if (collection === COLLECTION_NAMES.planOccurrences)
        throw new MongoServerError({
          code: 26,
          message: "Missing owned namespace",
        })
      return value.port.listIndexes(collection)
    },
  }
  expect(
    (await inspectRecurringSyncIndexReadiness(inspection)).missing
  ).toEqual([name])
  for (const change of [
    { unique: false },
    { key: { userId: 1, slotKey: 1, seriesId: 1 } },
    { sparse: true },
    { hidden: true },
    { partialFilterExpression: { deletedAt: null } },
  ]) {
    const next = fixture(),
      record = next.rows.get(COLLECTION_NAMES.planOccurrences)?.[0]
    if (!record) throw new Error("Expected identity index")
    Object.assign(record, change)
    expect(await inspectRecurringSyncIndexReadiness(next.port)).toEqual({
      ready: false,
      missing: [],
      incompatible: [name],
    })
  }
})
test("inspection propagates unexpected errors and selected definitions are independent clones", async () => {
  const first = selectRecurringSyncIndexSpecs()
  const occurrence = first.at(-1)
  if (!occurrence) throw new Error("Expected appearance identity definition")
  occurrence.options.unique = false
  expect(selectRecurringSyncIndexSpecs().at(-1)?.options.unique).toBe(true)
  await expect(
    inspectRecurringSyncIndexReadiness({
      listIndexes: async () => {
        throw new Error("Unavailable own inspection")
      },
    })
  ).rejects.toThrow("Unavailable")
})
