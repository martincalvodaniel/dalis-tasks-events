import { expect, test } from "bun:test"
import { validateLocalRecurringItemResult } from "@/lib/sync/local-recurring-item-result"
import { localSyncResultInputSchema } from "@/schemas/local-sync"
import { planDraftSchema } from "@/schemas/plan-item"

const userId = "recurring-root-result-owner",
  timestamp = "2026-10-11T13:00:00.000Z"
function fixture() {
  const itemId = crypto.randomUUID(),
    operationId = crypto.randomUUID()
  const input = planDraftSchema.parse({
    kind: "plan",
    variant: "appointment",
    title: "Series",
    description: "",
    status: "not_started",
    checklist: [],
    schedule: {
      mode: "all_day",
      startDate: "2026-10-11",
      endDateExclusive: "2026-10-12",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-11",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
  })
  return {
    operation: {
      operationId,
      protocolVersion: 1,
      baseRevision: 0,
      command: { type: "item.create", itemId, input },
    },
    senderId: crypto.randomUUID(),
    result: {
      status: "applied",
      operationId,
      sequence: 1,
      item: {
        ...input,
        id: itemId,
        ownerId: userId,
        completedAt: null,
        revision: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      },
    },
  }
}
test("series root create, edit and delete correspondence keep exact actor, identity, revision and content", () => {
  const value = fixture(),
    before = structuredClone(value)
  expect(validateLocalRecurringItemResult(value, userId)).toEqual(
    localSyncResultInputSchema.parse(value)
  )
  const edited = {
    ...value,
    operation: {
      ...value.operation,
      baseRevision: 1,
      command: { ...value.operation.command, type: "item.update" },
    },
    result: { ...value.result, item: { ...value.result.item, revision: 2 } },
  }
  expect(validateLocalRecurringItemResult(edited, userId)).toEqual(
    localSyncResultInputSchema.parse(edited)
  )
  const deleted = {
    ...edited,
    operation: {
      ...edited.operation,
      command: { type: "item.delete", itemId: value.operation.command.itemId },
    },
    result: {
      ...edited.result,
      item: { ...edited.result.item, deletedAt: timestamp },
    },
  }
  expect(validateLocalRecurringItemResult(deleted, userId)).toEqual(
    localSyncResultInputSchema.parse(deleted)
  )
  expect(value).toEqual(before)
})
test("forged root content, foreign identity or actor, revision, UUID and appearance commands are rejected", () => {
  const value = fixture()
  for (const invalid of [
    { ...value, result: { ...value.result, operationId: crypto.randomUUID() } },
    {
      ...value,
      result: { ...value.result, item: { ...value.result.item, revision: 2 } },
    },
    {
      ...value,
      result: {
        ...value.result,
        item: { ...value.result.item, ownerId: "foreign" },
      },
    },
    {
      ...value,
      result: {
        ...value.result,
        item: { ...value.result.item, id: crypto.randomUUID() },
      },
    },
    {
      ...value,
      result: {
        ...value.result,
        item: { ...value.result.item, title: "Forged" },
      },
    },
    {
      ...value,
      result: {
        ...value.result,
        item: { ...value.result.item, variant: "note" },
      },
    },
    {
      ...value,
      result: {
        ...value.result,
        item: { ...value.result.item, recurrence: null },
      },
    },
    {
      ...value,
      operation: {
        ...value.operation,
        command: {
          type: "plan.cancel-occurrence",
          itemId: value.operation.command.itemId,
          occurrenceId: `${value.operation.command.itemId}:2026-10-11`,
          expectedOccurrenceRevision: 0,
        },
      },
    },
  ])
    expect(() => validateLocalRecurringItemResult(invalid, userId)).toThrow()
})
test("progress of a recurrent root is never ACK, while unsupported and conflict are still preserved evidence", () => {
  const value = fixture(),
    operation = {
      ...value.operation,
      command: {
        type: "plan.set-status",
        itemId: value.operation.command.itemId,
        status: "not_started",
      },
    }
  expect(() =>
    validateLocalRecurringItemResult({ ...value, operation }, userId)
  ).toThrow("progress")
  const unsupported = {
    ...value,
    operation,
    result: { status: "unsupported", operationId: operation.operationId },
  }
  expect(validateLocalRecurringItemResult(unsupported, userId)).toEqual(
    localSyncResultInputSchema.parse(unsupported)
  )
  const conflict = {
    ...value,
    result: {
      status: "conflict",
      operationId: value.operation.operationId,
      current: value.result.item,
    },
  }
  expect(validateLocalRecurringItemResult(conflict, userId)).toEqual(
    localSyncResultInputSchema.parse(conflict)
  )
})
