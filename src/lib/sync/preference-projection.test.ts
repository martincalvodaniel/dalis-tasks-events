import { expect, test } from "bun:test"
import { planRemotePreferenceProjection } from "@/lib/sync/preference-projection"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import type { OutboxEntry } from "@/types/local-sync"
import type { PersonalSnapshot } from "@/types/personal-snapshot"
import type {
  PreferenceEffect,
  RemotePreferenceEffects,
} from "@/types/preference-effects"
import type { RemoteShadowV2 } from "@/types/remote-shadow-v2"
import type { SyncCommand } from "@/types/sync"

const actor = "projection-owner"
const timestamp = "2026-10-08T00:00:00.000Z"
const firstId = crypto.randomUUID()
const secondId = crypto.randomUUID()
const itemId = crypto.randomUUID()

function tag(id = firstId, revision = 1, position = 1024): PreferenceEffect {
  return {
    store: "tags",
    record: {
      userId: actor,
      id,
      name: `Category ${id}`,
      normalizedName: `category ${id}`,
      color: "#123456",
      position,
      revision,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    },
  }
}
function view(revision = 1): PreferenceEffect {
  return {
    store: "itemViews",
    record: {
      userId: actor,
      itemId,
      primaryTagId: firstId,
      revision,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    },
  }
}
function shadow(
  effect: PreferenceEffect
): Extract<RemoteShadowV2, { kind: "preference" }> {
  if (effect.store !== "tags" && effect.store !== "itemViews")
    throw new Error("Expected supported fixture store")
  return {
    version: 2,
    kind: "preference",
    entityKey:
      effect.store === "tags"
        ? `tag:${effect.record.id}`
        : `item-view:${effect.record.itemId}`,
    record: effect,
  }
}
function snapshot(...effects: PreferenceEffect[]): PersonalSnapshot {
  return effects.map((effect) => ({
    entityKey: shadow(effect).entityKey,
    record: effect,
  }))
}
function incoming(...effects: PreferenceEffect[]): RemotePreferenceEffects {
  return {
    version: 1,
    userId: actor,
    operationId: crypto.randomUUID(),
    sequence: 100,
    effects,
  }
}
function entry(
  command: SyncCommand = { type: "tag.delete", tagId: firstId }
): OutboxEntry {
  const entityKey =
    command.type === "tag.delete" ||
    command.type === "tag.save" ||
    command.type === "tag.move"
      ? `tag:${command.tagId}`
      : command.type === "item-view.set"
        ? `item-view:${command.itemId}`
        : command.type === "task.move"
          ? taskPlacementEntityKey(
              command.occurrenceId ?? command.itemId,
              command.scope,
              command.date
            )
          : "itemId" in command
            ? `item:${command.itemId}`
            : "unsupported"
  return {
    userId: actor,
    entityKey,
    operation: {
      protocolVersion: 1,
      operationId: crypto.randomUUID(),
      baseRevision: 1,
      command,
    },
    sequence: 1,
    dependencies: [],
    state: "pending",
    attempts: 0,
    createdAt: timestamp,
    lease: null,
  }
}
function fixture() {
  return {
    userId: actor,
    local: snapshot(tag(firstId, 0, 4096), tag(secondId, 1, 8192), view(0)),
    shadows: [shadow(tag()), shadow(tag(secondId)), shadow(view())],
    incoming: incoming(tag(firstId, 2, 2048), tag(secondId, 7, 3072)),
    entries: [] as OutboxEntry[],
  }
}

test("personal compaction reconciles every cached identity by its independent revision", () => {
  const value = fixture()
  const newerFirst = tag(firstId, 8, 512)
  const cachedView = view(3)
  cachedView.record.deletedAt = timestamp
  value.shadows = [
    shadow(newerFirst),
    shadow(tag(secondId)),
    shadow(cachedView),
  ]
  const result = planRemotePreferenceProjection(value)
  expect(result.pending).toBe(false)
  expect(result.local).toEqual(
    snapshot(newerFirst, tag(secondId, 7, 3072), cachedView)
  )
  expect(result.shadows).toEqual([
    shadow(newerFirst),
    shadow(tag(secondId, 7, 3072)),
    shadow(cachedView),
  ])
  expect(result.local[2].record?.record.deletedAt).toBe(timestamp)
  expect(result.local[0].record?.record.revision).toBe(8)
  expect(result.local[1].record?.record.revision).toBe(7)
})

test("every unresolved personal state preserves the full local snapshot including secondary identities", () => {
  for (const state of ["pending", "sending", "conflict", "rejected"] as const) {
    const value = fixture()
    value.local[1] = { entityKey: `tag:${secondId}`, record: null }
    const pending = entry({ type: "tag.delete", tagId: crypto.randomUUID() })
    pending.state = state
    pending.lease =
      state === "sending"
        ? { ownerId: crypto.randomUUID(), expiresAt: timestamp }
        : null
    value.entries = [pending]
    const before = structuredClone(value)
    const result = planRemotePreferenceProjection(value)
    expect(result.pending).toBe(true)
    expect(result.local).toEqual(value.local)
    expect(result.local[0].record?.record.revision).toBe(0)
    expect(result.local[1].record).toBeNull()
    expect(result.shadows[1].record.record.revision).toBe(7)
    expect(value).toEqual(before)
  }
  const value = fixture()
  value.entries = [
    entry({
      type: "item-view.set",
      itemId: crypto.randomUUID(),
      primaryTagId: null,
    }),
  ]
  expect(planRemotePreferenceProjection(value).local).toEqual(value.local)
  value.entries = [
    entry({
      type: "task.move",
      itemId,
      occurrenceId: null,
      scope: "day",
      date: "2026-10-08",
      tagId: firstId,
      beforeId: null,
      afterId: null,
    }),
  ]
  expect(planRemotePreferenceProjection(value).pending).toBe(true)
  for (const command of [
    {
      type: "tag.save",
      tagId: firstId,
      input: { name: "Updated", color: "#123456", position: 1024 },
    },
    { type: "tag.move", tagId: firstId, beforeId: secondId, afterId: null },
  ] as const) {
    value.entries = [entry(command)]
    expect(planRemotePreferenceProjection(value).local).toEqual(value.local)
  }
})

test("unrelated content intentions do not block personal reconciliation", () => {
  for (const state of ["pending", "sending", "conflict", "rejected"] as const) {
    const value = fixture()
    const item = entry({ type: "item.delete", itemId })
    item.state = state
    item.lease =
      state === "sending"
        ? { ownerId: crypto.randomUUID(), expiresAt: timestamp }
        : null
    value.entries = [item]
    const result = planRemotePreferenceProjection(value)
    expect(result.pending).toBe(false)
    expect(result.local[0].record?.record.revision).toBe(2)
    expect(value.entries[0].state).toBe(state)
  }
})

test("supersession never grants ACK and an unresolved dependent still blocks the personal chain", () => {
  for (const state of ["acknowledged", "superseded"] as const) {
    const value = fixture()
    const parent = entry()
    parent.state = state
    value.entries = [parent]
    expect(planRemotePreferenceProjection(value).pending).toBe(false)
    expect(parent.state).toBe(state)
    const dependent = entry({
      type: "item-view.set",
      itemId,
      primaryTagId: firstId,
    })
    dependent.sequence = 2
    dependent.dependencies = [parent.operation.operationId]
    value.entries.push(dependent)
    const result = planRemotePreferenceProjection(value)
    expect(result.pending).toBe(true)
    expect(result.local).toEqual(value.local)
    expect(parent.state).toBe(state)
    expect(dependent.state).toBe("pending")
  }
})

test("cached shadows reconcile without incoming effects and unobserved local-only identities remain intact", () => {
  const localOnly = tag(crypto.randomUUID(), 0)
  const absence = {
    entityKey: `item-view:${crypto.randomUUID()}`,
    record: null,
  }
  const value = { ...fixture(), incoming: null }
  value.local.push(...snapshot(localOnly), absence)
  const result = planRemotePreferenceProjection(value)
  expect(result.pending).toBe(false)
  expect(result.local).toEqual([
    ...snapshot(tag(), tag(secondId), view()),
    ...snapshot(localOnly),
    absence,
  ])
  expect(result.shadows).toEqual(value.shadows)
  expect(result.local[3].record?.record.revision).toBe(0)
  expect(result.local[4].record).toBeNull()
  expect(
    result.shadows.some((record) => record.entityKey === absence.entityKey)
  ).toBe(false)
  expect(
    planRemotePreferenceProjection({
      userId: actor,
      local: [],
      shadows: [],
      incoming: null,
      entries: [],
    })
  ).toEqual({ local: [], shadows: [], pending: false })
})

test("equal replay returns independent clones and contradictory revisions reject without mutating input", () => {
  const value = fixture()
  value.incoming = incoming(tag(), tag(secondId))
  const before = structuredClone(value)
  const result = planRemotePreferenceProjection(value)
  expect(result.shadows).toEqual(value.shadows)
  result.shadows[0].record.record.revision = 99
  if (!result.local[0].record) throw new Error("Expected projected record")
  result.local[0].record.record.deletedAt = timestamp
  expect(value).toEqual(before)
  value.incoming = incoming(tag(firstId, 2), tag(secondId, 1, 99))
  const contradictory = structuredClone(value)
  expect(() => planRemotePreferenceProjection(value)).toThrow("same revision")
  expect(value).toEqual(contradictory)
  value.entries = [entry()]
  expect(() => planRemotePreferenceProjection(value)).toThrow("same revision")
})

test("an unresolved chain preserves complete absence while learning remote tombstones", () => {
  const deleted = tag()
  deleted.record.deletedAt = timestamp
  const value = {
    userId: actor,
    local: [],
    shadows: [],
    incoming: incoming(deleted),
    entries: [entry()],
  }
  const result = planRemotePreferenceProjection(value)
  expect(result.local).toEqual([])
  expect(result.pending).toBe(true)
  expect(result.shadows).toEqual([shadow(deleted)])
  const settled = planRemotePreferenceProjection({
    ...value,
    incoming: null,
    shadows: result.shadows,
    entries: [],
  })
  expect(settled.local).toEqual(snapshot(deleted))
})

test("all owners and outbox identities are validated even for unrelated content intentions", () => {
  const value = fixture()
  const foreignTag = tag()
  foreignTag.record.userId = "foreign"
  const item = entry({ type: "item.delete", itemId })
  const duplicateOperation = {
    ...entry(),
    sequence: 2,
    operation: item.operation,
    entityKey: item.entityKey,
  }
  const missingDependency = { ...item, dependencies: [crypto.randomUUID()] }
  const parent = entry()
  const reversedDependency = {
    ...item,
    dependencies: [parent.operation.operationId],
  }
  for (const invalid of [
    { ...value, userId: "foreign" },
    { ...value, local: snapshot(foreignTag) },
    { ...value, shadows: [shadow(foreignTag)] },
    { ...value, incoming: { ...value.incoming, userId: "foreign" } },
    { ...value, entries: [{ ...item, userId: "foreign" }] },
    { ...value, entries: [item, duplicateOperation] },
    { ...value, entries: [item, entry()] },
    { ...value, entries: [missingDependency] },
    { ...value, entries: [reversedDependency, parent] },
    { ...value, entries: [{ ...item, entityKey: `tag:${firstId}` }] },
    { ...value, shadows: [value.shadows[0], value.shadows[0]] },
    { ...value, local: [value.local[0], value.local[0]] },
    { ...value, local: [{ ...value.local[0], entityKey: `tag:${secondId}` }] },
    { ...value, incoming: incoming(tag(), tag()) },
  ])
    expect(() => planRemotePreferenceProjection(invalid)).toThrow()
})

test("unsupported stores, item shadows, future and malformed data reject the entire projection", () => {
  const value = fixture()
  const settings: PreferenceEffect = {
    store: "settings",
    record: {
      userId: actor,
      timeZone: "Europe/Madrid",
      weekStartsOn: 1,
      locale: "es-ES",
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    },
  }
  const placement: PreferenceEffect = {
    store: "taskPlacements",
    record: {
      userId: actor,
      occurrenceId: itemId,
      scope: "day",
      date: "2026-10-08",
      tagId: null,
      position: 1024,
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    },
  }
  for (const [effect, entityKey] of [
    [settings, `settings:${actor}`],
    [placement, taskPlacementEntityKey(itemId, "day", "2026-10-08")],
  ] as const) {
    for (const invalid of [
      { ...value, local: [{ entityKey, record: effect }] },
      { ...value, local: [{ entityKey, record: null }] },
      {
        ...value,
        shadows: [
          { version: 2, kind: "preference", entityKey, record: effect },
        ],
      },
      { ...value, incoming: incoming(tag(), effect) },
    ])
      expect(() => planRemotePreferenceProjection(invalid)).toThrow("support")
  }
  const itemShadow = {
    version: 2,
    kind: "item",
    entityKey: `item:${itemId}`,
    record: {
      id: itemId,
      ownerId: actor,
      kind: "task",
      title: "Remote",
      description: "",
      scheduledDate: "2026-10-08",
      status: "not_started",
      checklist: [],
      recurrence: null,
      completedAt: null,
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    },
  }
  expect(() =>
    planRemotePreferenceProjection({ ...value, shadows: [itemShadow] })
  ).toThrow("support")
  for (const invalid of [
    { ...value, future: true },
    { ...value, incoming: { ...value.incoming, version: 2 } },
    {
      ...value,
      incoming: {
        ...value.incoming,
        effects: [{ store: "future", record: {} }],
      },
    },
    { ...value, incoming: incoming(tag(firstId, 0)) },
    { ...value, shadows: [shadow(tag(firstId, 0))] },
    { ...value, shadows: [{ ...value.shadows[0], version: 3 }] },
    {
      ...value,
      entries: [
        entry({
          type: "settings.update",
          input: {
            timeZone: "Europe/Madrid",
            weekStartsOn: 1,
            locale: "es-ES",
          },
        }),
      ],
    },
  ])
    expect(() => planRemotePreferenceProjection(invalid)).toThrow()
})

test("the merged shadow snapshot cannot exceed its identity bound even with pending work", () => {
  const shadows = Array.from({ length: 10000 }, () =>
    shadow(tag(crypto.randomUUID()))
  )
  const value = {
    userId: actor,
    local: [],
    shadows,
    incoming: incoming(tag()),
    entries: [entry()],
  }
  const before = structuredClone(value)
  expect(() => planRemotePreferenceProjection(value)).toThrow(
    "shadow identity limit"
  )
  expect(value).toEqual(before)
})
