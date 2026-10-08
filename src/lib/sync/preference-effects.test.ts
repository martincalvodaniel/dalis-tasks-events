import { expect, test } from "bun:test"
import { validateRemotePreferenceEffects } from "@/lib/sync/preference-effects"
import {
  maximumPreferenceEffectsBytes,
  preferenceEffectKey,
} from "@/schemas/preference-effects"
import type {
  PreferenceEffect,
  RemotePreferenceEffects,
} from "@/types/preference-effects"

const userId = "browser-test-preference-effects"
const now = "2026-10-08T00:00:00.000Z"
const metadata = {
  revision: 1,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
}
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
function tag(tagId = id): PreferenceEffect {
  return {
    store: "tags",
    record: {
      ...metadata,
      id: tagId,
      userId,
      name: "Trabajo",
      normalizedName: "trabajo",
      color: "#ffffff",
      position: -0.5,
    },
  }
}
function effects(): RemotePreferenceEffects {
  return {
    version: 1,
    userId,
    operationId: crypto.randomUUID(),
    sequence: 1,
    effects: [
      tag(),
      {
        store: "itemViews",
        record: { ...metadata, userId, itemId: id, primaryTagId: id },
      },
      {
        store: "taskPlacements",
        record: {
          ...metadata,
          userId,
          occurrenceId: `${id}:2026-10-08`,
          scope: "day",
          date: "2026-10-08",
          tagId: id,
          position: 1024,
        },
      },
      {
        store: "taskPlacements",
        record: {
          ...metadata,
          userId,
          occurrenceId: id,
          scope: "overdue",
          date: "0001-01-01",
          tagId: null,
          position: 0,
        },
      },
      {
        store: "settings",
        record: {
          ...metadata,
          userId,
          timeZone: "Europe/Madrid",
          weekStartsOn: 1,
          locale: "es-ES",
        },
      },
    ],
  }
}

test("preference effects preserve mixed identities, tombstones and independent records", () => {
  const input = effects()
  input.effects[0].record.deletedAt = now
  const previous = JSON.stringify(input)
  const value = validateRemotePreferenceEffects(input, userId)
  expect(value).toEqual(input)
  expect(JSON.stringify(input)).toBe(previous)
  expect(value.effects[0].record.deletedAt).toBe(now)
  value.effects[0].record.deletedAt = null
  expect(input.effects[0].record.deletedAt).toBe(now)
  expect(input.effects.map(preferenceEffectKey)).toEqual([
    JSON.stringify(["tags", userId, id]),
    JSON.stringify(["itemViews", userId, id]),
    JSON.stringify([
      "taskPlacements",
      userId,
      `${id}:2026-10-08`,
      "day",
      "2026-10-08",
    ]),
    JSON.stringify(["taskPlacements", userId, id, "overdue", "0001-01-01"]),
    JSON.stringify(["settings", userId]),
  ])
  const second = tag(crypto.randomUUID())
  expect(preferenceEffectKey(second)).not.toBe(
    preferenceEffectKey(input.effects[0])
  )
  const other = structuredClone(second)
  other.record.userId = "another-account"
  expect(preferenceEffectKey(other)).not.toBe(preferenceEffectKey(second))
  expect(
    validateRemotePreferenceEffects(
      { ...input, effects: [tag(), second] },
      userId
    ).effects
  ).toHaveLength(2)
})

test("preference effects reject foreign accounts, duplicate document identities and invalid revisions", () => {
  const value = effects()
  expect(() =>
    validateRemotePreferenceEffects(value, "another-account")
  ).toThrow()
  const foreign = structuredClone(value)
  foreign.effects[1].record.userId = "another-account"
  expect(() => validateRemotePreferenceEffects(foreign, userId)).toThrow()
  for (const effect of value.effects) {
    expect(() =>
      validateRemotePreferenceEffects(
        { ...value, effects: [effect, effect] },
        userId
      )
    ).toThrow()
    expect(() =>
      validateRemotePreferenceEffects(
        {
          ...value,
          effects: [{ ...effect, record: { ...effect.record, revision: 0 } }],
        },
        userId
      )
    ).toThrow()
  }
  const differentTag = structuredClone(value.effects[2])
  if (differentTag.store !== "taskPlacements")
    throw new Error("Fixture placement missing")
  differentTag.record.tagId = null
  expect(() =>
    validateRemotePreferenceEffects(
      { ...value, effects: [value.effects[2], differentTag] },
      userId
    )
  ).toThrow()
  differentTag.record.date = "2026-10-09"
  expect(
    validateRemotePreferenceEffects(
      { ...value, effects: [value.effects[2], differentTag] },
      userId
    ).effects
  ).toHaveLength(2)
  const overdue = structuredClone(value.effects[3])
  if (overdue.store !== "taskPlacements")
    throw new Error("Fixture overdue missing")
  const malformed = structuredClone(overdue)
  malformed.record.occurrenceId = "invalid:reference"
  expect(() =>
    validateRemotePreferenceEffects({ ...value, effects: [malformed] }, userId)
  ).toThrow()
  overdue.record.date = "2026-10-08"
  expect(() =>
    validateRemotePreferenceEffects({ ...value, effects: [overdue] }, userId)
  ).toThrow()
})

test("preference effects reject unknown fields, invalid shapes, future versions and count bounds", () => {
  const value = effects()
  for (const change of [
    { version: 2 },
    { sequence: 0 },
    { operationId: "not-a-uuid" },
    { userId: "" },
    { effects: [] },
    { extra: true },
  ])
    expect(() =>
      validateRemotePreferenceEffects({ ...value, ...change }, userId)
    ).toThrow()
  expect(() =>
    validateRemotePreferenceEffects(
      {
        ...value,
        effects: [{ ...tag(), record: { ...tag().record, extra: true } }],
      },
      userId
    )
  ).toThrow()
  expect(() =>
    validateRemotePreferenceEffects(
      { ...value, effects: [{ store: "items", record: tag().record }] },
      userId
    )
  ).toThrow()
  expect(() =>
    validateRemotePreferenceEffects(
      {
        ...value,
        effects: Array.from({ length: 10001 }, () => tag(crypto.randomUUID())),
      },
      userId
    )
  ).toThrow()
  const invalid = tag()
  if (invalid.store !== "tags") throw new Error("Fixture tag missing")
  invalid.record.normalizedName = "incorrect"
  expect(() =>
    validateRemotePreferenceEffects({ ...value, effects: [invalid] }, userId)
  ).toThrow()
})

test("preference effect byte bound counts UTF8 without truncating the set", () => {
  const value = effects()
  const records = Array.from({ length: 1100 }, () => {
    const effect = tag(crypto.randomUUID())
    if (effect.store !== "tags") throw new Error("Fixture tag missing")
    effect.record.name = "ñ".repeat(60)
    effect.record.normalizedName = effect.record.name
    return effect
  })
  const input = { ...value, effects: records }
  expect(JSON.stringify(input).length).toBeLessThan(
    maximumPreferenceEffectsBytes
  )
  expect(
    new TextEncoder().encode(JSON.stringify(input)).byteLength
  ).toBeGreaterThan(maximumPreferenceEffectsBytes)
  expect(() => validateRemotePreferenceEffects(input, userId)).toThrow()
  const small = { ...value, effects: records.slice(0, 100) }
  expect(validateRemotePreferenceEffects(small, userId).effects).toHaveLength(
    100
  )
  expect(input.effects).toHaveLength(1100)
})
