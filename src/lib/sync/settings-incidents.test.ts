import { expect, test } from "bun:test"
import { planLocalSettingsPreferenceResult } from "@/lib/sync/preference-result-plan"
import {
  projectRecurringSettingsSyncIncidentOverview,
  projectRecurringSyncIncidentOverview,
} from "@/lib/sync/recurring-incident-snapshot"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { userSettingsEntityKey } from "@/schemas/user-settings-key"
import type { PreferenceEffect } from "@/types/preference-effects"

const actor = "settings-incident-owner",
  key = userSettingsEntityKey(actor),
  now = "2026-10-12T11:00:00.000Z"
function settings(
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
function fixture() {
  const operation = {
      operationId: crypto.randomUUID(),
      protocolVersion: 1 as const,
      baseRevision: 1,
      command: {
        type: "settings.update" as const,
        input: {
          timeZone: "Asia/Tokyo",
          weekStartsOn: 1 as const,
          locale: "es-ES" as const,
        },
      },
    },
    senderId = crypto.randomUUID()
  const entry = outboxEntrySchema.parse({
    userId: actor,
    entityKey: key,
    operation,
    state: "sending",
    attempts: 1,
    dependencies: [],
    sequence: 1,
    createdAt: now,
    lease: { ownerId: senderId, expiresAt: "2026-10-12T11:01:00.000Z" },
  })
  const plan = planLocalSettingsPreferenceResult({
    userId: actor,
    submission: {
      operation,
      senderId,
      result: {
        kind: "preference",
        outcome: {
          operationId: operation.operationId,
          status: "conflict",
          current: settings(2, "UTC"),
        },
      },
    },
    local: [{ entityKey: key, record: settings(1, "Asia/Tokyo") }],
    shadows: [
      {
        version: 2,
        kind: "preference",
        entityKey: key,
        record: settings(1, "Europe/Madrid"),
      },
    ],
    entries: [entry],
    existingOutcome: null,
  })
  return {
    userId: actor,
    items: [],
    occurrences: [],
    tags: [],
    itemViews: [],
    taskPlacements: [],
    settings: [settings(1, "Pacific/Honolulu").record],
    entries: plan.entries,
    outcomes: [plan.outcome],
    shadows: plan.shadows,
  }
}
test("settings incidents distinguish current, frozen, observed and latest remote values without writes", () => {
  const value = fixture(),
    before = JSON.stringify(value),
    overview = projectRecurringSettingsSyncIncidentOverview(value)
  const incident = overview[0]
  if (incident.kind !== "preference")
    throw new Error("Expected settings incident")
  expect(incident.incident.local[0].record).toEqual(
    settings(1, "Pacific/Honolulu")
  )
  expect(incident.incident.localAtOutcome[0].record).toEqual(
    settings(1, "Asia/Tokyo")
  )
  expect(incident.incident.shadowAtOutcome[0].record).toEqual(
    settings(1, "Europe/Madrid")
  )
  expect(incident.incident.remote[0].record).toEqual(settings(2, "UTC"))
  expect(JSON.stringify(value)).toBe(before)
  expect(() => projectRecurringSyncIncidentOverview(value)).toThrow()
})
test("absent current settings stay absent and tombstones retain their exact record", () => {
  const value = fixture()
  expect(
    projectRecurringSettingsSyncIncidentOverview({ ...value, settings: [] })[0]
      .incident.local
  ).toEqual([{ entityKey: key, record: null }])
  const tombstone = { ...settings(3, "UTC").record, deletedAt: now }
  expect(
    projectRecurringSettingsSyncIncidentOverview({
      ...value,
      settings: [tombstone],
    })[0].incident.local
  ).toEqual([
    { entityKey: key, record: { store: "settings", record: tombstone } },
  ])
})
test("foreign settings, duplicate local identity and inconsistent outcome fail the whole overview", () => {
  const value = fixture()
  expect(() =>
    projectRecurringSettingsSyncIncidentOverview({
      ...value,
      settings: [{ ...value.settings[0], userId: "other-owner" }],
    })
  ).toThrow("foreign")
  expect(() =>
    projectRecurringSettingsSyncIncidentOverview({
      ...value,
      settings: [...value.settings, ...value.settings],
    })
  ).toThrow("duplicate")
  expect(() =>
    projectRecurringSettingsSyncIncidentOverview({
      ...value,
      entries: [{ ...value.entries[0], state: "acknowledged" }],
    })
  ).toThrow()
})
