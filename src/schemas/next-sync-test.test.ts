import { describe, expect, test } from "bun:test"
import {
  nextSyncDeviceCommandSchema,
  nextSyncIndexControlSchema,
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
