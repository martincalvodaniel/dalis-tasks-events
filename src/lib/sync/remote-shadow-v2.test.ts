import { expect, test } from "bun:test"
import {
  decodeRemoteShadow,
  validateRemoteShadowV2,
} from "@/lib/sync/remote-shadow-v2"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import { personalShadowEntityKey } from "@/schemas/remote-shadow-v2"
import type { CalendarItem } from "@/types/calendar-item"
import type { PreferenceEffect } from "@/types/preference-effects"

const actor = "shadow-owner"
const timestamp = "2026-10-08T00:00:00.000Z"
const metadata = {
  revision: 2,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
}
function item(): CalendarItem {
  return {
    ...metadata,
    id: crypto.randomUUID(),
    ownerId: actor,
    kind: "task",
    title: "Observed task",
    description: "",
    scheduledDate: "2026-10-08",
    status: "not_started",
    checklist: [],
    completedAt: null,
    recurrence: null,
  }
}
function preferences(): PreferenceEffect[] {
  return [
    {
      store: "tags",
      record: {
        ...metadata,
        userId: actor,
        id: crypto.randomUUID(),
        name: "Observed",
        normalizedName: "observed",
        color: "#123456",
        position: 1024,
      },
    },
    {
      store: "itemViews",
      record: {
        ...metadata,
        userId: actor,
        itemId: crypto.randomUUID(),
        primaryTagId: null,
      },
    },
    {
      store: "taskPlacements",
      record: {
        ...metadata,
        userId: actor,
        occurrenceId: `${crypto.randomUUID()}:2026-10-08`,
        scope: "day",
        date: "2026-10-09",
        tagId: null,
        position: 1024,
      },
    },
    {
      store: "settings",
      record: {
        ...metadata,
        userId: actor,
        timeZone: "Europe/Madrid",
        weekStartsOn: 1,
        locale: "es-ES",
      },
    },
  ]
}

test("legacy item shadows normalize read-only and preserve tombstones, identity and revision", () => {
  const record = { ...item(), deletedAt: timestamp }
  const legacy = { entityKey: `item:${record.id}`, record }
  const before = structuredClone(legacy)
  const normalized = decodeRemoteShadow(legacy, actor)
  expect(normalized).toEqual({ ...legacy, version: 2 as const, kind: "item" })
  expect(decodeRemoteShadow(normalized, actor)).toEqual(normalized)
  normalized.record = item()
  expect(legacy).toEqual(before)
  expect(decodeRemoteShadow(legacy, actor)).toEqual({
    ...before,
    version: 2 as const,
    kind: "item" as const,
  })
  expect(() => decodeRemoteShadow(legacy, "foreign")).toThrow()
  expect(() =>
    decodeRemoteShadow(
      { ...legacy, entityKey: `item:${crypto.randomUUID()}` },
      actor
    )
  ).toThrow()
})

test("personal shadows preserve independent document identities and cloned tombstones", () => {
  const effects = preferences()
  const keys = effects.map(personalShadowEntityKey)
  const tag = effects[0]
  const view = effects[1]
  const placement = effects[2]
  if (
    tag.store !== "tags" ||
    view.store !== "itemViews" ||
    placement.store !== "taskPlacements"
  )
    throw new Error("Expected fixture stores")
  expect(keys).toEqual([
    `tag:${tag.record.id}`,
    `item-view:${view.record.itemId}`,
    taskPlacementEntityKey(placement.record.occurrenceId, "day", "2026-10-09"),
    `settings:${actor}`,
  ])
  for (const effect of effects) {
    const deleted = structuredClone(effect)
    deleted.record.deletedAt = timestamp
    const input = {
      version: 2 as const,
      kind: "preference" as const,
      entityKey: personalShadowEntityKey(effect),
      record: deleted,
    }
    const before = structuredClone(input)
    const decoded = decodeRemoteShadow(input, actor)
    expect(decoded).toEqual(input)
    if (decoded.kind !== "preference")
      throw new Error("Expected personal shadow")
    decoded.record.record.revision = 9
    expect(input).toEqual(before)
    expect(validateRemoteShadowV2(before, actor)).toEqual(before)
    expect(() => decodeRemoteShadow(input, "foreign")).toThrow()
    expect(() =>
      decodeRemoteShadow(
        {
          ...input,
          entityKey: keys[(keys.indexOf(input.entityKey) + 1) % keys.length],
        },
        actor
      )
    ).toThrow()
  }
})

test("placement shadows retain canonical scope and date instead of conflating occurrences", () => {
  const effect = preferences()[2]
  if (effect.store !== "taskPlacements") throw new Error("Expected placement")
  const overdue: PreferenceEffect = {
    ...effect,
    record: { ...effect.record, scope: "overdue", date: "0001-01-01" },
  }
  const shadow = {
    version: 2 as const,
    kind: "preference" as const,
    entityKey: personalShadowEntityKey(overdue),
    record: overdue,
  }
  expect(decodeRemoteShadow(shadow, actor)).toEqual(shadow)
  expect(() =>
    decodeRemoteShadow(
      { ...shadow, entityKey: personalShadowEntityKey(effect) },
      actor
    )
  ).toThrow()
  expect(() =>
    decodeRemoteShadow(
      {
        ...shadow,
        record: {
          ...overdue,
          record: { ...overdue.record, date: "2026-10-09" },
        },
      },
      actor
    )
  ).toThrow()
})

test("future, extra, ambiguous and corrupt shadows reject without legacy fallback", () => {
  const record = item()
  const shadow = {
    version: 2 as const,
    kind: "item" as const,
    entityKey: `item:${record.id}`,
    record,
  }
  for (const input of [
    { ...shadow, version: 3 },
    { ...shadow, unexpected: true },
    { ...shadow, kind: "preference" },
    { ...shadow, record: { ...record, revision: -1 } },
    { ...shadow, record: { ...record, ownerId: "foreign" } },
    { ...shadow, kind: "future" },
    { entityKey: shadow.entityKey, record, kind: "item" },
  ])
    expect(() => decodeRemoteShadow(input, actor)).toThrow()
  const effect = preferences()[0]
  const personal = {
    version: 2 as const,
    kind: "preference" as const,
    entityKey: personalShadowEntityKey(effect),
    record: effect,
  }
  expect(() =>
    decodeRemoteShadow(
      { ...personal, record: { ...effect, store: "future" } },
      actor
    )
  ).toThrow()
  expect(() => decodeRemoteShadow(personal, "")).toThrow()
})
