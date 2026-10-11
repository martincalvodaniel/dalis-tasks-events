import { describe, expect, test } from "bun:test"
import {
  nextRecurringSyncStateSchema,
  nextSyncDeviceCommandSchema,
  nextSyncIndexControlSchema,
  nextSyncStateSchema,
} from "@/schemas/next-sync-test"
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
