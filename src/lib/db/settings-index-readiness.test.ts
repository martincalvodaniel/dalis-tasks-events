import "server-only"
import { expect, test } from "bun:test"
import { COLLECTION_NAMES, type CollectionName } from "@/lib/db/collections"
import {
  inspectRecurringSyncIndexReadiness,
  inspectSettingsSyncIndexReadiness,
} from "@/lib/db/mixed-sync-index-readiness"
import { selectSettingsSyncIndexSpecs } from "@/lib/db/mixed-sync-index-specs"
import { settingsSyncIndexReadinessSchema } from "@/schemas/settings-sync-index-provisioning"

function fixture() {
  const rows = new Map<CollectionName, Record<string, unknown>[]>(),
    calls: CollectionName[] = []
  for (const spec of selectSettingsSyncIndexSpecs()) {
    const name = spec.collection as CollectionName
    rows.set(name, [
      ...(rows.get(name) ?? []),
      { key: structuredClone(spec.keys), ...structuredClone(spec.options) },
    ])
  }
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
test("settings readiness inspects six registered indexes without widening generation five", async () => {
  const value = fixture(),
    before = structuredClone([...value.rows])
  expect(selectSettingsSyncIndexSpecs()).toHaveLength(6)
  expect(await inspectSettingsSyncIndexReadiness(value.port)).toEqual({
    ready: true,
    missing: [],
    incompatible: [],
  })
  expect(value.calls).toContain(COLLECTION_NAMES.userSettings)
  expect([...value.rows]).toEqual(before)
  value.calls.length = 0
  expect((await inspectRecurringSyncIndexReadiness(value.port)).ready).toBe(
    true
  )
  expect(value.calls).not.toContain(COLLECTION_NAMES.userSettings)
})
test("missing or incompatible settings uniqueness fails readiness without provisioning or repair", async () => {
  const value = fixture(),
    name = "user_settings_user_uidx"
  value.rows.delete(COLLECTION_NAMES.userSettings)
  expect(await inspectSettingsSyncIndexReadiness(value.port)).toEqual({
    ready: false,
    missing: [name],
    incompatible: [],
  })
  for (const override of [
    { unique: false },
    { key: { other: 1 } },
    { sparse: true },
    { hidden: true },
    { partialFilterExpression: { deletedAt: null } },
  ]) {
    const value = fixture(),
      record = value.rows.get(COLLECTION_NAMES.userSettings)?.[0]
    if (!record) throw new Error("Settings index fixture is missing")
    Object.assign(record, override)
    expect(
      (await inspectSettingsSyncIndexReadiness(value.port)).incompatible
    ).toEqual([name])
  }
  expect(() =>
    settingsSyncIndexReadinessSchema.parse({
      ready: true,
      missing: [name],
      incompatible: [],
    })
  ).toThrow()
  expect(() =>
    settingsSyncIndexReadinessSchema.parse({
      ready: false,
      missing: [name],
      incompatible: [name],
    })
  ).toThrow()
})
