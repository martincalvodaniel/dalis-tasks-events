import { expect, test } from "bun:test"
import { planLocalSettingsPreferenceResult } from "@/lib/sync/preference-result-plan"
import { projectRecurringSettingsSyncIncidentOverview } from "@/lib/sync/recurring-incident-snapshot"
import {
  availableSettingsResolutionChoices,
  planSettingsIncidentResolution,
  validateSettingsResolutionRecord,
} from "@/lib/sync/settings-resolution"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { userSettingsEntityKey } from "@/schemas/user-settings-key"
import type { PreferenceEffect } from "@/types/preference-effects"

function fixture() {
  const actor = "settings-resolution-owner",
    key = userSettingsEntityKey(actor),
    now = "2026-10-17T19:20:00.000Z"
  function effect(
    revision: number,
    timeZone: string
  ): Extract<PreferenceEffect, { store: "settings" }> {
    return {
      store: "settings",
      record: {
        userId: actor,
        timeZone,
        revision,
        weekStartsOn: 1,
        locale: "es-ES",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    }
  }
  const senderId = crypto.randomUUID(),
    operation = {
      protocolVersion: 1 as const,
      operationId: crypto.randomUUID(),
      baseRevision: 1,
      command: {
        type: "settings.update" as const,
        input: {
          timeZone: "Asia/Tokyo",
          weekStartsOn: 1 as const,
          locale: "es-ES" as const,
        },
      },
    }
  const sending = outboxEntrySchema.parse({
    userId: actor,
    entityKey: key,
    operation,
    sequence: 1,
    dependencies: [],
    state: "sending",
    attempts: 1,
    createdAt: now,
    lease: { ownerId: senderId, expiresAt: now },
  })
  const child = outboxEntrySchema.parse({
    ...sending,
    state: "pending",
    attempts: 0,
    lease: null,
    sequence: 2,
    dependencies: [operation.operationId],
    operation: { ...operation, operationId: crypto.randomUUID() },
  })
  const result = planLocalSettingsPreferenceResult({
    userId: actor,
    submission: {
      operation,
      senderId,
      result: {
        kind: "preference",
        outcome: {
          operationId: operation.operationId,
          status: "conflict",
          current: effect(2, "UTC"),
        },
      },
    },
    local: [{ entityKey: key, record: effect(1, "Asia/Tokyo") }],
    shadows: [
      {
        version: 2,
        kind: "preference",
        entityKey: key,
        record: effect(1, "Europe/Madrid"),
      },
    ],
    entries: [sending, child],
    existingOutcome: null,
  })
  const input = {
    userId: actor,
    items: [],
    occurrences: [],
    tags: [],
    itemViews: [],
    taskPlacements: [],
    settings: [effect(1, "Pacific/Honolulu").record],
    entries: result.entries,
    outcomes: [result.outcome],
    shadows: result.shadows,
  }
  const projected = projectRecurringSettingsSyncIncidentOverview(input)[0]
  if (projected.kind !== "preference")
    throw new Error("Settings fixture is missing")
  const current = projected.incident,
    request = {
      userId: actor,
      resolutionId: crypto.randomUUID(),
      operationId: crypto.randomUUID(),
      choice: "retry_local" as const,
      createdAt: now,
      expected: current,
    }
  return { current, request, input, effect, key }
}

test("settings choices adopt without ACK or retry the latest explicit local zone with fresh CAS", () => {
  const { current, request } = fixture(),
    before = JSON.stringify(current)
  expect(availableSettingsResolutionChoices(current)).toEqual([
    "adopt_remote",
    "retry_local",
  ])
  const adopt = planSettingsIncidentResolution(
    { ...request, operationId: null, choice: "adopt_remote" },
    current
  )
  expect(adopt.local.timeZone).toBe("UTC")
  expect(adopt.replacement).toBeNull()
  const retry = planSettingsIncidentResolution(request, current)
  expect(retry.replacement).toMatchObject({
    baseRevision: 2,
    operationId: request.operationId,
    command: {
      type: "settings.update",
      input: { timeZone: "Pacific/Honolulu" },
    },
  })
  expect(retry.local.revision).toBe(2)
  expect(retry.supersededOperationIds).toEqual(
    current.intentions.map((entry) => entry.operation.operationId)
  )
  expect(JSON.stringify(current)).toBe(before)
})
test("later observed remote state controls CAS without pretending its shadow was the original ancestor", () => {
  const { input, effect, key, request } = fixture()
  input.shadows = [
    {
      version: 2,
      kind: "preference",
      entityKey: key,
      record: effect(4, "America/New_York"),
    },
  ]
  const overview = projectRecurringSettingsSyncIncidentOverview(input)[0]
  if (overview.kind !== "preference")
    throw new Error("Settings fixture changed kind")
  const record = planSettingsIncidentResolution(
    { ...request, expected: overview.incident },
    overview.incident
  )
  expect(record.replacement?.baseRevision).toBe(4)
  expect(record.expected.shadowAtOutcome[0].record?.record.revision).toBe(1)
  expect(() =>
    planSettingsIncidentResolution(request, overview.incident)
  ).toThrow("changed")
})
test("settings resolution rejects foreign, blocked, uncertain, missing and tombstoned remote comparisons", () => {
  for (const change of [
    (v: ReturnType<typeof fixture>["current"]) => {
      v.blockedByRelatedIntentions = true
    },
    (v: ReturnType<typeof fixture>["current"]) => {
      v.intentions[1].attempts = 1
    },
    (v: ReturnType<typeof fixture>["current"]) => {
      v.entry.userId = "foreign-owner"
    },
    (v: ReturnType<typeof fixture>["current"]) => {
      v.remote[0].record = null
    },
    (v: ReturnType<typeof fixture>["current"]) => {
      const r = v.remote[0].record
      if (r) r.record.deletedAt = "2026-10-17T20:00:00.000Z"
    },
  ]) {
    const { current, request } = fixture()
    change(current)
    expect(availableSettingsResolutionChoices(current)).toEqual([])
    expect(() => planSettingsIncidentResolution(request, current)).toThrow()
  }
})
test("projection detects external dependent chains and adoption never supersedes independent preferences", () => {
  const { input, key } = fixture()
  const tagId = crypto.randomUUID()
  const tag = outboxEntrySchema.parse({
    ...input.entries[1],
    entityKey: `tag:${tagId}`,
    sequence: 3,
    dependencies: [],
    operation: {
      protocolVersion: 1,
      operationId: crypto.randomUUID(),
      baseRevision: 0,
      command: {
        type: "tag.save",
        tagId,
        input: { name: "Independent", color: "#123456", position: 0 },
      },
    },
  })
  const independent = projectRecurringSettingsSyncIncidentOverview({
    ...input,
    entries: [...input.entries, tag],
  })[0]
  if (independent.kind !== "preference")
    throw new Error("Settings fixture changed kind")
  const request = {
    userId: input.userId,
    resolutionId: crypto.randomUUID(),
    operationId: null,
    choice: "adopt_remote",
    createdAt: "2026-10-17T19:20:00.000Z",
    expected: independent.incident,
  }
  expect(
    planSettingsIncidentResolution(request, independent.incident)
      .supersededOperationIds
  ).toEqual(
    input.entries
      .filter((entry) => entry.entityKey === key)
      .map((entry) => entry.operation.operationId)
  )
  tag.dependencies = [input.entries[0].operation.operationId]
  const blocked = projectRecurringSettingsSyncIncidentOverview({
    ...input,
    entries: [...input.entries, tag],
  })[0]
  expect(availableSettingsResolutionChoices(blocked.incident)).toEqual([])
})

test("missing local settings allow adoption only and a frozen outcome cannot be rewritten", () => {
  const { current, request } = fixture()
  current.local[0].record = null
  expect(availableSettingsResolutionChoices(current)).toEqual(["adopt_remote"])
  expect(() => planSettingsIncidentResolution(request, current)).toThrow()
  expect(
    planSettingsIncidentResolution(
      { ...request, choice: "adopt_remote", operationId: null },
      current
    ).local.timeZone
  ).toBe("UTC")
  const changed = fixture()
  changed.current.localAtOutcome = structuredClone(
    changed.current.localAtOutcome
  )
  const observed = changed.current.localAtOutcome[0].record
  if (observed?.store !== "settings")
    throw new Error("Settings fixture changed store")
  observed.record.timeZone = "Europe/London"
  expect(availableSettingsResolutionChoices(changed.current)).toEqual([])
})

test("reused identities, malformed choices and contradictory equal revisions never resolve", () => {
  const { current, request } = fixture()
  expect(() =>
    planSettingsIncidentResolution(
      { ...request, operationId: request.resolutionId },
      current
    )
  ).toThrow()
  expect(() =>
    planSettingsIncidentResolution(
      { ...request, resolutionId: current.entry.operation.operationId },
      current
    )
  ).toThrow()
  expect(() =>
    planSettingsIncidentResolution(
      { ...request, choice: "adopt_remote" },
      current
    )
  ).toThrow()
  current.remote = structuredClone(current.remote)
  const remote = current.remote[0].record
  if (remote?.store !== "settings")
    throw new Error("Settings fixture changed store")
  remote.record.timeZone = "America/Los_Angeles"
  expect(availableSettingsResolutionChoices(current)).toEqual([])
})

test("durable settings decisions validate their actor and exact planned value without performing IO", () => {
  const { current, request } = fixture(),
    record = planSettingsIncidentResolution(request, current)
  expect(validateSettingsResolutionRecord(record, request.userId)).toEqual(
    record
  )
  expect(() =>
    validateSettingsResolutionRecord(record, "foreign-owner")
  ).toThrow()
  expect(() =>
    validateSettingsResolutionRecord(
      { ...record, local: { ...record.local, timeZone: "UTC" } },
      request.userId
    )
  ).toThrow()
  expect(() =>
    validateSettingsResolutionRecord(
      { ...record, supersededOperationIds: [record.supersededOperationIds[0]] },
      request.userId
    )
  ).toThrow()
})
