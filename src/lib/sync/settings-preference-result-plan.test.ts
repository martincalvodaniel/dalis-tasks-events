import { expect, test } from "bun:test"
import { planRemotePreferenceProjection } from "@/lib/sync/preference-projection"
import {
  planLocalPreferenceResult,
  planLocalSettingsPreferenceResult,
} from "@/lib/sync/preference-result-plan"
import { planSettingsPreferenceProjection } from "@/lib/sync/settings-preference-projection"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { userSettingsEntityKey } from "@/schemas/user-settings-key"
import type { OutboxEntry } from "@/types/local-sync"
import type { PersonalSnapshot } from "@/types/personal-snapshot"
import type { PreferenceEffect } from "@/types/preference-effects"
import type { UserSettings } from "@/types/preferences"
import type { RemoteShadowV2 } from "@/types/remote-shadow-v2"
import type { SyncOperation } from "@/types/sync"

const actor = "settings-result-owner",
  sender = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const now = "2026-10-12T08:00:00.000Z",
  key = userSettingsEntityKey(actor)
const tagId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
function settings(revision = 1, timeZone = "Europe/Madrid"): UserSettings {
  return {
    userId: actor,
    timeZone,
    weekStartsOn: 1,
    locale: "es-ES",
    revision,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}
function effect(revision = 1, timeZone = "Europe/Madrid"): PreferenceEffect {
  return { store: "settings", record: settings(revision, timeZone) }
}
function tag(revision = 1): PreferenceEffect {
  return {
    store: "tags",
    record: {
      userId: actor,
      id: tagId,
      name: "Category",
      normalizedName: "category",
      color: "#123abc",
      position: 1024,
      revision,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  }
}
function operation(baseRevision = 0): SyncOperation {
  return {
    operationId: crypto.randomUUID(),
    protocolVersion: 1,
    baseRevision,
    command: {
      type: "settings.update",
      input: { timeZone: "Europe/Madrid", weekStartsOn: 1, locale: "es-ES" },
    },
  }
}
function entry(
  operation: SyncOperation,
  sequence = 1,
  dependencies: string[] = [],
  state: OutboxEntry["state"] = "sending",
  attempts = 1
): OutboxEntry {
  return outboxEntrySchema.parse({
    userId: actor,
    entityKey: operation.command.type === "tag.save" ? `tag:${tagId}` : key,
    operation,
    sequence,
    dependencies,
    state,
    attempts,
    createdAt: now,
    lease:
      state === "sending"
        ? { ownerId: sender, expiresAt: "2026-10-12T08:01:00.000Z" }
        : null,
  })
}
function shadow(
  record: PreferenceEffect
): Extract<RemoteShadowV2, { kind: "preference" }> {
  return {
    version: 2,
    kind: "preference",
    entityKey: record.store === "settings" ? key : `tag:${tagId}`,
    record,
  }
}
function fixture() {
  const submitted = operation()
  return {
    userId: actor,
    submission: {
      operation: submitted,
      senderId: sender,
      result: {
        kind: "preference" as const,
        outcome: {
          operationId: submitted.operationId,
          status: "applied" as const,
          effects: {
            version: 1 as const,
            userId: actor,
            operationId: submitted.operationId,
            sequence: 1,
            effects: [effect()],
          },
        },
      },
    },
    local: [{ entityKey: key, record: effect(0) }] as PersonalSnapshot,
    shadows: [] as Extract<RemoteShadowV2, { kind: "preference" }>[],
    entries: [entry(submitted)],
    existingOutcome: null as unknown,
  }
}
function categoryIntention(sequence = 2): OutboxEntry {
  return entry(
    {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 0,
      command: {
        type: "tag.save",
        tagId,
        input: { name: "Category", color: "#123abc", position: 1024 },
      },
    },
    sequence,
    [],
    "pending",
    0
  )
}

test("prepared settings ACK requires the sender and captures immutable local and observed evidence", () => {
  const value = fixture(),
    before = JSON.stringify(value)
  const plan = planLocalSettingsPreferenceResult(value)
  expect(plan.status).toBe("applied")
  expect(plan.entries[0].state).toBe("acknowledged")
  expect(plan.entries[0].lease).toBeNull()
  expect(plan.local.find((record) => record.entityKey === key)?.record).toEqual(
    effect()
  )
  expect(plan.outcome.local).toEqual(value.local)
  expect(plan.outcome.base).toEqual([{ entityKey: key, record: null }])
  expect(JSON.stringify(value)).toBe(before)
  expect(() =>
    planLocalSettingsPreferenceResult({
      ...value,
      submission: { ...value.submission, senderId: crypto.randomUUID() },
    })
  ).toThrow("lease")
  expect(() => planLocalPreferenceResult(value)).toThrow("support this command")
})
test("category conflicts cannot hold the confirmed settings projection", () => {
  const value = fixture(),
    blocked = categoryIntention()
  value.entries.push({ ...blocked, state: "conflict" })
  value.local.push({ entityKey: `tag:${tagId}`, record: tag(0) })
  const plan = planLocalSettingsPreferenceResult(value)
  expect(plan.local.find((record) => record.entityKey === key)?.record).toEqual(
    effect()
  )
  expect(
    plan.local.find((record) => record.entityKey === `tag:${tagId}`)?.record
  ).toEqual(tag(0))
  expect(plan.entries[1]).toEqual(value.entries[1])
})
test("settings pending cannot hold another confirmed preference projection", () => {
  const value = fixture(),
    submitted = categoryIntention(2).operation
  value.entries = [
    entry(value.submission.operation, 1, [], "pending", 0),
    entry(submitted, 2),
  ]
  value.local.push({ entityKey: `tag:${tagId}`, record: tag(0) })
  const plan = planLocalSettingsPreferenceResult({
    ...value,
    submission: {
      operation: submitted,
      senderId: sender,
      result: {
        kind: "preference",
        outcome: {
          operationId: submitted.operationId,
          status: "applied",
          effects: {
            version: 1,
            userId: actor,
            operationId: submitted.operationId,
            sequence: 1,
            effects: [tag()],
          },
        },
      },
    },
  })
  expect(plan.local.find((record) => record.entityKey === key)?.record).toEqual(
    effect(0)
  )
  expect(
    plan.local.find((record) => record.entityKey === `tag:${tagId}`)?.record
  ).toEqual(tag())
  expect(plan.entries[0].state).toBe("pending")
  expect(plan.entries[1].state).toBe("acknowledged")
})
test("only an unattempted direct dependent rebases to its parent's actual effect", () => {
  const value = fixture(),
    dependent = operation(),
    attempted = operation()
  value.entries.push(
    entry(dependent, 2, [value.submission.operation.operationId], "pending", 0),
    entry(attempted, 3, [value.submission.operation.operationId], "pending", 1)
  )
  value.local = [{ entityKey: key, record: effect(0, "America/Los_Angeles") }]
  const plan = planLocalSettingsPreferenceResult(value)
  expect(plan.entries[1].operation.baseRevision).toBe(1)
  expect(plan.entries[1].operation.command).toEqual(dependent.command)
  expect(plan.entries[2]).toEqual(value.entries[2])
  expect(plan.local).toEqual(value.local)
})
test("a late ACK cannot downgrade a deliberate later CAS or a newer observed settings shadow", () => {
  const value = fixture(),
    child = operation(4)
  value.entries.push(
    entry(child, 2, [value.submission.operation.operationId], "pending", 0)
  )
  value.local = [{ entityKey: key, record: effect(0, "America/Los_Angeles") }]
  value.shadows = [shadow(effect(4, "UTC"))]
  const plan = planLocalSettingsPreferenceResult(value)
  expect(plan.entries[1]).toEqual(value.entries[1])
  expect(plan.shadows).toEqual(value.shadows)
  expect(plan.outcome.base).toEqual([
    { entityKey: key, record: effect(4, "UTC") },
  ])
  expect(plan.local).toEqual(value.local)
})
test("replay returns the durable outcome without restoring earlier projected settings", () => {
  const value = fixture(),
    applied = planLocalSettingsPreferenceResult(value)
  value.entries = applied.entries
  value.existingOutcome = applied.outcome
  value.local = [{ entityKey: key, record: effect(2, "UTC") }]
  value.shadows = [shadow(effect(2, "UTC"))]
  const replay = planLocalSettingsPreferenceResult(value)
  expect(replay.status).toBe("replayed")
  expect(replay.local).toEqual(value.local)
  expect(replay.shadows).toEqual(value.shadows)
  expect(replay.outcome).toEqual(applied.outcome)
  expect(() =>
    planLocalSettingsPreferenceResult({ ...value, existingOutcome: null })
  ).toThrow()
})
test("pull projection applies settings independently and preserves each family's pending local state", () => {
  const value = fixture(),
    category = categoryIntention()
  const input = {
    userId: actor,
    local: [...value.local, { entityKey: `tag:${tagId}`, record: tag(0) }],
    shadows: [],
    entries: [category],
    incoming: {
      version: 1,
      userId: actor,
      operationId: crypto.randomUUID(),
      sequence: 1,
      effects: [effect(3, "UTC"), tag(2)],
    },
  }
  const projection = planSettingsPreferenceProjection(input)
  expect(
    projection.local.find((record) => record.entityKey === key)?.record
  ).toEqual(effect(3, "UTC"))
  expect(
    projection.local.find((record) => record.entityKey === `tag:${tagId}`)
      ?.record
  ).toEqual(tag(0))
  expect(projection.pending).toBe(true)
  expect(() => planRemotePreferenceProjection(input)).toThrow("local store")
  const reverse = planSettingsPreferenceProjection({
    ...input,
    entries: [entry(value.submission.operation, 1, [], "pending", 0)],
  })
  expect(
    reverse.local.find((record) => record.entityKey === key)?.record
  ).toEqual(effect(0))
  expect(
    reverse.local.find((record) => record.entityKey === `tag:${tagId}`)?.record
  ).toEqual(tag(2))
})
test("unexpected extra effects, foreign context and conflicting same revisions reject completely", () => {
  const value = fixture()
  const effects = value.submission.result.outcome.effects
  expect(() =>
    planLocalSettingsPreferenceResult({
      ...value,
      submission: {
        ...value.submission,
        result: {
          kind: "preference",
          outcome: {
            ...value.submission.result.outcome,
            effects: { ...effects, effects: [effect(), tag()] },
          },
        },
      },
    })
  ).toThrow("only its own")
  expect(() =>
    planLocalSettingsPreferenceResult({
      ...value,
      local: [{ entityKey: "settings:foreign", record: null }],
    })
  ).toThrow()
  expect(() =>
    planLocalSettingsPreferenceResult({
      ...value,
      shadows: [shadow(effect()), shadow(effect())],
    })
  ).toThrow()
  expect(() =>
    planLocalSettingsPreferenceResult({
      ...value,
      shadows: [shadow(effect(1, "UTC"))],
    })
  ).toThrow("same revision")
  expect(() =>
    planLocalSettingsPreferenceResult({
      ...value,
      entries: [...value.entries, value.entries[0]],
    })
  ).toThrow()
  const foreign = tag()
  foreign.record.userId = "foreign"
  expect(() =>
    planLocalSettingsPreferenceResult({ ...value, shadows: [shadow(foreign)] })
  ).toThrow()
})
test("conflict and rejection keep local settings and dependents without inventing an ACK", () => {
  const value = fixture(),
    dependent = entry(
      operation(),
      2,
      [value.submission.operation.operationId],
      "pending",
      0
    )
  value.entries.push(dependent)
  const conflict = planLocalSettingsPreferenceResult({
    ...value,
    submission: {
      ...value.submission,
      result: {
        kind: "preference",
        outcome: {
          operationId: value.submission.operation.operationId,
          status: "conflict",
          current: effect(5, "UTC"),
        },
      },
    },
  })
  expect(conflict.entries[0].state).toBe("conflict")
  expect(conflict.entries[1]).toEqual(dependent)
  expect(conflict.local).toEqual(value.local)
  expect(conflict.outcome.base).toEqual([{ entityKey: key, record: null }])
  expect(conflict.shadows).toEqual([shadow(effect(5, "UTC"))])
  const unavailable = planLocalSettingsPreferenceResult({
    ...value,
    submission: {
      ...value.submission,
      result: {
        kind: "preference",
        outcome: {
          operationId: value.submission.operation.operationId,
          status: "unavailable",
        },
      },
    },
  })
  expect(unavailable.entries[0].state).toBe("rejected")
  expect(unavailable.entries[1]).toEqual(dependent)
  expect(unavailable.shadows).toEqual([])
})
