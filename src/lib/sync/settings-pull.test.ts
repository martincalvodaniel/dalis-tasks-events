import { expect, test } from "bun:test"
import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import {
  planLocalRecurringChangesPage,
  planLocalSettingsChangesPage,
  validateLocalSettingsChangesPageInput,
} from "@/lib/sync/local-recurring-pull"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"
import { userSettingsEntityKey } from "@/schemas/user-settings-key"
import type { OutboxEntry } from "@/types/local-sync"
import type { PersonalSnapshot } from "@/types/personal-snapshot"
import type { PreferenceEffect } from "@/types/preference-effects"
import type {
  RemoteRecurringChange,
  RemoteRecurringShadow,
} from "@/types/remote-recurring-sync"

const actor = "settings-pull-owner",
  now = "2026-10-12T09:00:00.000Z",
  tagId = crypto.randomUUID()
function settings(revision = 1, timeZone = "Europe/Madrid"): PreferenceEffect {
  return {
    store: "settings",
    record: {
      userId: actor,
      timeZone,
      weekStartsOn: 1,
      locale: "es-ES",
      revision,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  }
}
function tag(): PreferenceEffect {
  return {
    store: "tags",
    record: {
      id: tagId,
      userId: actor,
      name: "Category",
      normalizedName: "category",
      color: "#123abc",
      position: 1024,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  }
}
function change(
  effect: PreferenceEffect,
  sequence: number
): RemoteRecurringChange {
  const operationId = crypto.randomUUID()
  return {
    version: 2,
    kind: "preference",
    recipientUserId: actor,
    operationId,
    sequence,
    effects: {
      version: 1,
      userId: actor,
      operationId,
      sequence,
      effects: [effect],
    },
  }
}
function receipt(
  changes: RemoteRecurringChange[],
  after = 0,
  through = after + changes.length
) {
  return {
    query: { after, through: null, limit: 100 },
    page: {
      version: 2 as const,
      changes,
      nextAfter: after + changes.length,
      through,
      hasMore: after + changes.length < through,
    },
  }
}
function fixture() {
  return {
    userId: actor,
    receipt: receipt([change(settings(), 1), change(tag(), 2)]),
    cursor: { key: "pull-cursor" as const, after: 0, through: null },
    items: [],
    occurrences: [],
    local: [
      { entityKey: userSettingsEntityKey(actor), record: settings(0, "UTC") },
    ] as PersonalSnapshot,
    entries: [] as OutboxEntry[],
    shadows: [] as RemoteRecurringShadow[],
  }
}
function pending(type: "settings" | "tag"): OutboxEntry {
  return outboxEntrySchema.parse({
    userId: actor,
    entityKey:
      type === "settings" ? userSettingsEntityKey(actor) : `tag:${tagId}`,
    sequence: 1,
    state: "pending",
    attempts: 1,
    createdAt: now,
    lease: null,
    dependencies: [],
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 0,
      command:
        type === "settings"
          ? {
              type: "settings.update",
              input: { timeZone: "UTC", weekStartsOn: 1, locale: "es-ES" },
            }
          : { type: "tag.delete", tagId },
    },
  })
}

test("future settings pull projects all records and advances cursor without acknowledging intentions", () => {
  const value = fixture(),
    before = JSON.stringify(value),
    plan = planLocalSettingsChangesPage(value)
  expect(plan.cursor).toEqual({ key: "pull-cursor", after: 2, through: null })
  expect(
    plan.local.find((entry) => entry.entityKey === userSettingsEntityKey(actor))
      ?.record
  ).toEqual(settings())
  expect(plan.shadows).toHaveLength(2)
  expect(JSON.stringify(value)).toBe(before)
  expect(() => planLocalRecurringChangesPage(value)).toThrow("does not support")
})
test("pending settings retain their local value without freezing categories", () => {
  const value = fixture()
  value.entries = [pending("settings")]
  const plan = planLocalSettingsChangesPage(value)
  expect(
    plan.local.find((entry) => entry.entityKey === userSettingsEntityKey(actor))
      ?.record
  ).toEqual(settings(0, "UTC"))
  expect(
    plan.local.find((entry) => entry.entityKey === `tag:${tagId}`)?.record
  ).toEqual(tag())
  expect(value.entries[0].state).toBe("pending")
  expect(value.entries[0].operation.baseRevision).toBe(0)
})
test("a blocked category retains its projection while settings download proceeds", () => {
  const value = fixture()
  value.entries = [{ ...pending("tag"), state: "conflict" }]
  const plan = planLocalSettingsChangesPage(value)
  expect(
    plan.local.find((entry) => entry.entityKey === userSettingsEntityKey(actor))
      ?.record
  ).toEqual(settings())
  expect(
    plan.local.find((entry) => entry.entityKey === `tag:${tagId}`)
  ).toBeUndefined()
  expect(plan.shadows).toHaveLength(2)
})
test("late settings pages preserve newer shadow and completely stale pages are ignored", () => {
  const value = fixture()
  value.shadows = [
    {
      version: 2,
      kind: "preference",
      entityKey: userSettingsEntityKey(actor),
      record: settings(4, "Asia/Tokyo"),
    },
  ]
  const plan = planLocalSettingsChangesPage(value)
  expect(
    plan.local.find((entry) => entry.entityKey === userSettingsEntityKey(actor))
      ?.record
  ).toEqual(settings(4, "Asia/Tokyo"))
  const stale = {
    ...value,
    cursor: { key: "pull-cursor", after: 3, through: null },
  }
  expect(planLocalSettingsChangesPage(stale).status).toBe("ignored")
  expect(planLocalSettingsChangesPage(stale).cursor.after).toBe(3)
})
test("whole page rejects foreign records, wrong checkpoint, missing dependency and same-revision disagreement", () => {
  const value = fixture()
  const foreign = settings()
  foreign.record.userId = "other-owner"
  expect(() =>
    validateLocalSettingsChangesPageInput(
      receipt([change(tag(), 1), change(foreign, 2)]),
      actor
    )
  ).toThrow()
  expect(() =>
    planLocalSettingsChangesPage({
      ...value,
      cursor: { key: "pull-cursor", after: 1, through: 2 },
    })
  ).toThrow("cursor")
  expect(() =>
    planLocalSettingsChangesPage({
      ...value,
      local: [{ entityKey: "settings:other-owner", record: null }],
    })
  ).toThrow()
  expect(() =>
    planLocalSettingsChangesPage({
      ...value,
      entries: [
        { ...pending("settings"), dependencies: [crypto.randomUUID()] },
      ],
    })
  ).toThrow()
  expect(() =>
    planLocalSettingsChangesPage({
      ...value,
      shadows: [
        {
          version: 2,
          kind: "preference",
          entityKey: userSettingsEntityKey(actor),
          record: settings(1, "UTC"),
        },
      ],
    })
  ).toThrow("same revision")
})
test("settings can share a complete page with a recurring parent and appearance without changing series timezone", () => {
  const series = planSchema.parse({
    kind: "plan",
    variant: "note",
    id: crypto.randomUUID(),
    ownerId: actor,
    title: "Series",
    description: "",
    status: "not_started",
    completedAt: null,
    checklist: [],
    schedule: {
      mode: "all_day",
      startDate: "2026-10-12",
      endDateExclusive: "2026-10-13",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-12",
      timeZone: "America/New_York",
      end: { type: "never" },
    },
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  const appearance = {
    ...applyPlanOccurrenceCommand(
      series,
      null,
      {
        type: "plan.set-occurrence-status",
        itemId: series.id,
        occurrenceId: `${series.id}:2026-10-12`,
        status: "completed",
      },
      actor,
      now
    ),
    revision: 1,
  }
  const changes: RemoteRecurringChange[] = [
    change(settings(1, "Asia/Tokyo"), 1),
    {
      version: 2,
      kind: "item",
      recipientUserId: actor,
      operationId: crypto.randomUUID(),
      sequence: 2,
      item: series,
    },
    {
      version: 2,
      kind: "plan-occurrence",
      recipientUserId: actor,
      operationId: crypto.randomUUID(),
      sequence: 3,
      occurrence: appearance,
      seriesRevision: 1,
    },
  ]
  const plan = planLocalSettingsChangesPage({
    ...fixture(),
    receipt: receipt(changes),
  })
  expect(plan.items).toEqual([series])
  expect(plan.occurrences).toEqual([appearance])
  expect(plan.shadows).toHaveLength(3)
  expect(plan.cursor.after).toBe(3)
})
