import { describe, expect, test } from "bun:test"
import { planOccurrenceCohortResolutionFixture } from "@/lib/backup/plan-occurrence-cohort-resolution-fixture"
import { editablePlanOccurrence } from "@/lib/calendar/plan-occurrence-command"
import {
  nextRecurringSyncStateSchema,
  nextSettingsProofScopeSchema,
  nextSettingsSyncStateSchema,
  nextSyncDeviceCommandSchema,
  nextSyncIndexControlSchema,
  nextSyncLocalOwnershipSchema,
  nextSyncStateSchema,
} from "@/schemas/next-sync-test"
import { planSchema } from "@/schemas/plan-item"
import { planSaveRequestSchema } from "@/schemas/plan-save"

const request = planSaveRequestSchema.parse({
  mode: "create",
  itemId: "11111111-1111-4111-8111-111111111111",
  contentOperationId: "22222222-2222-4222-8222-222222222222",
  viewOperationId: "33333333-3333-4333-8333-333333333333",
  primaryTagId: null,
  now: "2026-10-10T14:00:00.000Z",
  input: {
    kind: "plan",
    variant: "note",
    title: "Shared plan",
    description: "",
    status: "not_started",
    checklist: [],
    recurrence: null,
    schedule: {
      mode: "all_day",
      startDate: "2026-10-10",
      endDateExclusive: "2026-10-11",
    },
  },
})

describe("compiled Next common-plan fixture input", () => {
  test("validates the real atomic save request without accepting partial operation pairs", () => {
    expect(
      nextSyncDeviceCommandSchema.parse({ type: "save-plan", request })
    ).toEqual({ type: "save-plan", request })
    expect(() =>
      nextSyncDeviceCommandSchema.parse({
        type: "save-plan",
        request: { ...request, viewOperationId: request.contentOperationId },
      })
    ).toThrow()
    expect(() =>
      nextSyncDeviceCommandSchema.parse({
        type: "save-plan",
        request: {
          ...request,
          input: { ...request.input, variant: "birthday" },
        },
      })
    ).toThrow()
  })
  test("readiness fault injection accepts only a run capability and fixed operation", () => {
    const runId = request.itemId
    expect(
      nextSyncIndexControlSchema.parse({ runId, command: "block" })
    ).toEqual({ runId, command: "block" })
    expect(
      nextSyncIndexControlSchema.parse({ runId, command: "restore" })
    ).toEqual({ runId, command: "restore" })
    for (const input of [
      { runId, command: "delete", collection: "items" },
      { runId, command: "block", database: "production" },
      { command: "restore" },
    ])
      expect(() => nextSyncIndexControlSchema.parse(input)).toThrow()
  })
})

test("recurring fixture state admits appearances without widening generation four", () => {
  const seriesId = request.itemId
  const now = request.now
  const state = {
    counts: { items: 1, tags: 0, views: 0, receipts: 1, occurrences: 1 },
    page: {
      version: 2,
      nextAfter: 1,
      through: 1,
      hasMore: false,
      changes: [
        {
          version: 2,
          kind: "plan-occurrence",
          recipientUserId: "fixture-owner",
          operationId: request.contentOperationId,
          sequence: 1,
          seriesRevision: 1,
          occurrence: {
            kind: "plan",
            id: `${seriesId}:2026-10-10`,
            seriesId,
            slotKey: "2026-10-10",
            schedule: {
              mode: "all_day",
              startDate: "2026-10-10",
              endDateExclusive: "2026-10-11",
            },
            status: "not_started",
            checklist: [],
            completedAt: null,
            cancelled: false,
            revision: 1,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          },
        },
      ],
    },
  }
  expect(nextRecurringSyncStateSchema.parse(state).counts).toEqual(state.counts)
  expect(() => nextSyncStateSchema.parse(state)).toThrow()
  expect(() =>
    nextRecurringSyncStateSchema.parse({
      ...state,
      page: { ...state.page, nextAfter: 0 },
    })
  ).toThrow()
})

test("appearance fixture binds expected records and cannot inject the captured CAS toggle", () => {
  const series = planSchema.parse({
    ...request.input,
    id: request.itemId,
    ownerId: "fixture-owner",
    completedAt: null,
    revision: 1,
    createdAt: request.now,
    updatedAt: request.now,
    deletedAt: null,
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-10",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
  })
  const command = {
    type: "plan.set-occurrence-status" as const,
    itemId: series.id,
    occurrenceId: `${series.id}:2026-10-10`,
    status: "in_progress" as const,
  }
  const input = {
    type: "commit-occurrence",
    command,
    operationId: request.contentOperationId,
    now: request.now,
    expectedItem: series,
    expectedOccurrence: editablePlanOccurrence(
      series,
      null,
      command,
      series.ownerId
    ).current,
  }
  expect(nextSyncDeviceCommandSchema.parse(input).type).toBe(
    "commit-occurrence"
  )
  for (const invalid of [
    { ...input, captureRemoteRevision: false },
    { ...input, command: { ...command, expectedOccurrenceRevision: 12 } },
    { ...input, expectedItem: { ...series, id: request.viewOperationId } },
    { ...input, userId: "foreign" },
  ])
    expect(nextSyncDeviceCommandSchema.safeParse(invalid).success).toBe(false)
})

test("recurring movement fixture excludes simple plans and injected execution options", () => {
  const input = {
    type: "commit-recurring-move",
    operationId: request.contentOperationId,
    now: request.now,
    command: {
      type: "task.move",
      itemId: request.itemId,
      occurrenceId: `${request.itemId}:2026-10-10`,
      scope: "day",
      date: "2026-10-10",
      tagId: null,
      beforeId: null,
      afterId: null,
    },
  }
  expect(nextSyncDeviceCommandSchema.parse(input).type).toBe(
    "commit-recurring-move"
  )
  for (const invalid of [
    { ...input, command: { ...input.command, occurrenceId: null } },
    { ...input, userId: "foreign" },
    { ...input, allowSeries: false },
  ])
    expect(nextSyncDeviceCommandSchema.safeParse(invalid).success).toBe(false)
})

test("settings fixture state requires its separate count without weakening previous scopes", () => {
  const state = {
    counts: {
      items: 0,
      tags: 0,
      views: 0,
      receipts: 0,
      occurrences: 0,
      settings: 0,
    },
    page: {
      version: 2 as const,
      changes: [],
      nextAfter: 0,
      through: 0,
      hasMore: false,
    },
  }
  expect(nextSettingsSyncStateSchema.parse(state)).toEqual(state)
  expect(() => nextRecurringSyncStateSchema.parse(state)).toThrow()
  const { settings: _settings, ...oldCounts } = state.counts
  expect(() =>
    nextSettingsSyncStateSchema.parse({ ...state, counts: oldCounts })
  ).toThrow()
  expect(() =>
    nextSettingsSyncStateSchema.parse({
      ...state,
      counts: { ...state.counts, settings: -1 },
    })
  ).toThrow()
  expect(() =>
    nextSettingsSyncStateSchema.parse({
      ...state,
      counts: { ...state.counts, production: 1 },
    })
  ).toThrow()
})

test("settings fixture commands preserve expected records and reject unvalidated device inputs", () => {
  const valid = {
    type: "save-settings",
    input: { timeZone: "Asia/Tokyo", weekStartsOn: 1, locale: "es-ES" },
    expected: null,
  } as const
  expect(nextSyncDeviceCommandSchema.parse(valid)).toEqual(valid)
  for (const invalid of [
    { ...valid, input: { ...valid.input, timeZone: "invalid-zone" } },
    { ...valid, input: { ...valid.input, weekStartsOn: 0 } },
    { ...valid, expected: {} },
    { ...valid, database: "production" },
  ])
    expect(nextSyncDeviceCommandSchema.safeParse(invalid).success).toBe(false)
  const ownership = {
    runId: request.itemId,
    userId: "fixture-settings-owner",
    epoch: request.contentOperationId,
    markerBefore: null,
    markerAfter: null,
  }
  expect(nextSyncLocalOwnershipSchema.parse(ownership)).toEqual(ownership)
  expect(
    nextSyncLocalOwnershipSchema.safeParse({ ...ownership, epoch: "invalid" })
      .success
  ).toBe(false)
  expect(
    nextSyncLocalOwnershipSchema.safeParse({
      ...ownership,
      database: "production",
    }).success
  ).toBe(false)
})

test("joint fixture commands keep strict identities and reject unknown fields", () => {
  const operationId = crypto.randomUUID()
  expect(
    nextSyncDeviceCommandSchema.parse({ type: "joint-comparison", operationId })
  ).toEqual({ type: "joint-comparison", operationId })
  for (const invalid of [
    { type: "joint-comparison", operationId: "invalid" },
    { type: "joint-comparison", operationId, database: "production" },
    { type: "resolve-joint", request: {} },
    { type: "joint-guard-proof", request: {} },
    { type: "lost-joint-view-response-run", operationId },
  ])
    expect(nextSyncDeviceCommandSchema.safeParse(invalid).success).toBe(false)
})

test("focused Next proof scope is explicit, defaults to full and rejects unknown selections", () => {
  expect(nextSettingsProofScopeSchema.parse(undefined)).toBe("full")
  expect(nextSettingsProofScopeSchema.parse("joint-ui")).toBe("joint-ui")
  expect(nextSettingsProofScopeSchema.parse("assignment")).toBe("assignment")
  expect(nextSettingsProofScopeSchema.parse("tag-order")).toBe("tag-order")
  expect(nextSettingsProofScopeSchema.parse("tag-order-ui")).toBe(
    "tag-order-ui"
  )
  expect(nextSettingsProofScopeSchema.parse("assignment-series")).toBe(
    "assignment-series"
  )
  for (const invalid of ["", "skip-auth", "joint", 1, null, {}])
    expect(nextSettingsProofScopeSchema.safeParse(invalid).success).toBe(false)
})

test("order fixture commands keep exact identity and reject missing or untrusted inputs", () => {
  const operationId = crypto.randomUUID()
  expect(
    nextSyncDeviceCommandSchema.parse({
      type: "tag-order-comparison",
      operationId,
    })
  ).toEqual({ type: "tag-order-comparison", operationId })
  for (const value of [
    { type: "tag-order-comparison", operationId: "invalid" },
    { type: "tag-order-comparison", operationId, database: "production" },
    { type: "resolve-tag-order", request: {} },
    { type: "resolve-tag-order-ui", request: {} },
    { type: "tag-order-guard-proof", request: {} },
  ])
    expect(nextSyncDeviceCommandSchema.safeParse(value).success).toBe(false)
})

test("order fixture uses validated real category move and deletion producers", () => {
  const tagId = crypto.randomUUID()
  for (const command of [
    { type: "tag.move", tagId, beforeId: null, afterId: crypto.randomUUID() },
    { type: "tag.delete", tagId },
  ] as const)
    expect(
      nextSyncDeviceCommandSchema.parse({ type: "commit-local", command })
    ).toEqual({ type: "commit-local", command })
  expect(
    nextSyncDeviceCommandSchema.safeParse({
      type: "commit-local",
      command: { type: "tag.move", tagId, beforeId: "invalid", afterId: null },
    }).success
  ).toBe(false)
})

test("category deletion fixture scope and commands reject unreviewed inputs", () => {
  expect(nextSettingsProofScopeSchema.parse("tag-delete")).toBe("tag-delete")
  expect(nextSettingsProofScopeSchema.parse("tag-delete-ui")).toBe(
    "tag-delete-ui"
  )
  const operationId = crypto.randomUUID()
  expect(
    nextSyncDeviceCommandSchema.parse({
      type: "tag-delete-comparison",
      operationId,
    })
  ).toEqual({ type: "tag-delete-comparison", operationId })
  for (const invalid of [
    { type: "tag-delete-comparison", operationId: "invalid" },
    { type: "tag-delete-comparison", operationId, database: "production" },
    { type: "resolve-tag-delete", request: {} },
    { type: "resolve-tag-delete-ui", request: {} },
    { type: "tag-delete-guard-proof", request: {} },
  ])
    expect(nextSyncDeviceCommandSchema.safeParse(invalid).success).toBe(false)
})

test("simple placement fixture scope and producer preserve the explicit movement boundary", () => {
  expect(nextSettingsProofScopeSchema.parse("placement")).toBe("placement")
  expect(nextSettingsProofScopeSchema.parse("placement-ui")).toBe(
    "placement-ui"
  )
  const operationId = crypto.randomUUID(),
    itemId = crypto.randomUUID(),
    command = {
      type: "task.move",
      itemId,
      occurrenceId: null,
      scope: "day",
      date: "2026-10-19",
      tagId: null,
      beforeId: null,
      afterId: null,
    } as const
  expect(
    nextSyncDeviceCommandSchema.parse({
      type: "commit-simple-move",
      operationId,
      command,
    })
  ).toEqual({ type: "commit-simple-move", operationId, command })
  expect(
    nextSyncDeviceCommandSchema.parse({
      type: "placement-comparison",
      operationId,
    })
  ).toEqual({ type: "placement-comparison", operationId })
  for (const invalid of [
    {
      type: "commit-simple-move",
      operationId,
      command: { ...command, occurrenceId: `${itemId}:2026-10-19` },
    },
    { type: "placement-comparison", operationId: "invalid" },
    { type: "placement-comparison", operationId, database: "production" },
    { type: "resolve-placement", request: {} },
    { type: "resolve-placement-ui", request: {} },
    { type: "placement-guard-proof", request: {} },
  ])
    expect(nextSyncDeviceCommandSchema.safeParse(invalid).success).toBe(false)
})

test("multi-slot fixture scope and commands preserve the exact reviewed cohort", () => {
  const fixture = planOccurrenceCohortResolutionFixture()
  const request = { ...fixture.request, choice: fixture.record.choice }
  expect(nextSettingsProofScopeSchema.parse("appearance-cohort")).toBe(
    "appearance-cohort"
  )
  expect(
    nextSyncDeviceCommandSchema.parse({
      type: "appearance-cohort-comparison",
      operationId: fixture.source.operationId,
    })
  ).toEqual({
    type: "appearance-cohort-comparison",
    operationId: fixture.source.operationId,
  })
  expect(
    nextSyncDeviceCommandSchema.parse({
      type: "resolve-appearance-cohort",
      request,
    })
  ).toEqual({ type: "resolve-appearance-cohort", request })
  for (const invalid of [
    { type: "appearance-cohort-comparison" },
    { type: "resolve-appearance-cohort", request: {} },
    {
      type: "appearance-cohort-comparison",
      operationId: fixture.source.operationId,
      unsafe: true,
    },
  ])
    expect(nextSyncDeviceCommandSchema.safeParse(invalid).success).toBe(false)
})

test("multi-slot UI fixture requires a full review without widening other commands", () => {
  const f = planOccurrenceCohortResolutionFixture(),
    request = { ...f.request, choice: f.record.choice }
  expect(nextSettingsProofScopeSchema.parse("appearance-cohort-ui")).toBe(
    "appearance-cohort-ui"
  )
  expect(
    nextSyncDeviceCommandSchema.parse({
      type: "resolve-appearance-cohort-ui",
      request,
    })
  ).toEqual({ type: "resolve-appearance-cohort-ui", request })
  for (const input of [
    { type: "resolve-appearance-cohort-ui", request: {} },
    { type: "resolve-appearance-cohort-ui", request, unsafe: true },
  ])
    expect(nextSyncDeviceCommandSchema.safeParse(input).success).toBe(false)
})
