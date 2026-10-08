import { expect, test } from "bun:test"
import { syncOperationFingerprint } from "@/lib/sync/operation-fingerprint"
import { validateRemotePushResultV2 } from "@/lib/sync/remote-push-v2"
import { remoteOperationResultV2Schema } from "@/schemas/remote-operation-result-v2"
import {
  maximumRemotePushInputV2Bytes,
  maximumRemotePushResultV2Bytes,
  remotePushInputV2Schema,
  remotePushResultV2Schema,
} from "@/schemas/remote-push-v2"
import { syncBatchSchema } from "@/schemas/sync"
import type { CalendarItem } from "@/types/calendar-item"
import type { RemoteOperationResultV2 } from "@/types/remote-operation-result-v2"
import type { SyncOperation } from "@/types/sync"

const actor = "mixed-push-owner"
const timestamp = "2026-10-08T00:00:00.000Z"
const metadata = {
  revision: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
}
const bytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength
function fixture() {
  const item: CalendarItem = {
    ...metadata,
    id: crypto.randomUUID(),
    ownerId: actor,
    kind: "task",
    title: "Owned task",
    description: "",
    scheduledDate: "2026-10-08",
    status: "not_started",
    checklist: [],
    completedAt: null,
    recurrence: null,
  }
  const tagId = crypto.randomUUID()
  const operations: SyncOperation[] = [
    {
      protocolVersion: 1,
      operationId: crypto.randomUUID(),
      baseRevision: 0,
      command: {
        type: "item.create",
        itemId: item.id,
        input: {
          kind: "task",
          title: item.title,
          description: "",
          scheduledDate: "2026-10-08",
          status: "not_started",
          checklist: [],
          recurrence: null,
        },
      },
    },
    {
      protocolVersion: 1,
      operationId: crypto.randomUUID(),
      baseRevision: 1,
      command: { type: "tag.delete", tagId },
    },
    {
      protocolVersion: 1,
      operationId: crypto.randomUUID(),
      baseRevision: 0,
      command: { type: "item-view.set", itemId: item.id, primaryTagId: null },
    },
  ]
  const results: RemoteOperationResultV2[] = [
    {
      kind: "item",
      outcome: {
        operationId: operations[0].operationId,
        status: "applied",
        item,
        sequence: 1,
      },
    },
    {
      kind: "preference",
      outcome: {
        operationId: operations[1].operationId,
        status: "conflict",
        current: {
          store: "tags",
          record: {
            ...metadata,
            id: tagId,
            userId: actor,
            name: "Own",
            normalizedName: "own",
            color: "#123456",
            position: 0,
          },
        },
      },
    },
    {
      kind: "preference",
      outcome: {
        operationId: operations[2].operationId,
        status: "applied",
        effects: {
          version: 1,
          userId: actor,
          operationId: operations[2].operationId,
          sequence: 2,
          effects: [
            {
              store: "itemViews",
              record: {
                ...metadata,
                userId: actor,
                itemId: item.id,
                primaryTagId: null,
              },
            },
          ],
        },
      },
    },
  ]
  return {
    request: {
      transportVersion: 2 as const,
      expectedUserId: actor,
      operations,
    },
    response: {
      transportVersion: 2 as const,
      status: "complete" as const,
      results,
    },
  }
}

test("transport two retains exact durable intentions and mixed outcomes with independent payloads", () => {
  const { request, response } = fixture()
  const before = structuredClone({ request, response })
  const parsed = remotePushInputV2Schema.parse(request)
  expect(parsed.operations).toEqual(request.operations)
  for (let index = 0; index < parsed.operations.length; index++) {
    expect(parsed.operations[index].protocolVersion).toBe(1)
    expect(syncOperationFingerprint(parsed.operations[index])).toBe(
      syncOperationFingerprint(request.operations[index])
    )
  }
  const checked = validateRemotePushResultV2(response, actor, request)
  expect(checked).toEqual(response)
  if (checked.status !== "complete")
    throw new Error("Expected complete response")
  const first = checked.results[0]
  if (first.kind === "item" && first.outcome.status === "applied")
    first.outcome.item.title = "Changed clone"
  parsed.operations[0].operationId = crypto.randomUUID()
  expect({ request, response }).toEqual(before)
  for (const status of [
    "unauthorized",
    "invalid_batch",
    "account_changed",
    "update_required",
  ] as const)
    expect(
      validateRemotePushResultV2(
        { transportVersion: 2, status },
        actor,
        request
      )
    ).toEqual({ transportVersion: 2, status })
})

test("retry responses identify the exact next intention after a complete ordered prefix", () => {
  const { request, response } = fixture()
  for (let count = 0; count < request.operations.length; count++) {
    const retry = {
      transportVersion: 2 as const,
      status: "retry_later" as const,
      results: response.results.slice(0, count),
      failedOperationId: request.operations[count].operationId,
    }
    expect(validateRemotePushResultV2(retry, actor, request)).toEqual(retry)
  }
  for (const invalid of [
    { ...response, results: response.results.slice(0, 2) },
    {
      ...response,
      results: [response.results[1], response.results[0], response.results[2]],
    },
    {
      ...response,
      results: [response.results[0], response.results[0], response.results[2]],
    },
    {
      transportVersion: 2,
      status: "retry_later",
      results: [],
      failedOperationId: request.operations[1].operationId,
    },
    {
      transportVersion: 2,
      status: "retry_later",
      results: response.results,
      failedOperationId: request.operations[0].operationId,
    },
  ])
    expect(() => validateRemotePushResultV2(invalid, actor, request)).toThrow()
})

test("input, account, family and primary target validation reject incompatible or unrelated outcomes", () => {
  const { request, response } = fixture()
  for (const invalid of [
    { ...request, transportVersion: 1 },
    { ...request, transportVersion: 3 },
    { ...request, extra: true },
    { ...request, operations: [request.operations[0], request.operations[0]] },
    {
      ...request,
      operations: [{ ...request.operations[0], protocolVersion: 2 }],
    },
    { expectedUserId: actor, operations: request.operations },
  ])
    expect(() => remotePushInputV2Schema.parse(invalid)).toThrow()
  expect(() =>
    validateRemotePushResultV2(response, "other-actor", request)
  ).toThrow()
  expect(() => validateRemotePushResultV2(response, "", request)).toThrow()
  const foreign = structuredClone(response)
  if (
    foreign.results[0].kind !== "item" ||
    foreign.results[0].outcome.status !== "applied"
  )
    throw new Error("Expected item fixture")
  foreign.results[0].outcome.item.ownerId = "other-actor"
  expect(() => validateRemotePushResultV2(foreign, actor, request)).toThrow()
  foreign.results[0].outcome.item.ownerId = actor
  foreign.results[0].outcome.item.id = crypto.randomUUID()
  expect(() => validateRemotePushResultV2(foreign, actor, request)).toThrow()
  const unrelated = structuredClone(response)
  const conflict = unrelated.results[1]
  if (
    conflict.kind !== "preference" ||
    conflict.outcome.status !== "conflict" ||
    conflict.outcome.current.store !== "tags"
  )
    throw new Error("Expected category conflict")
  conflict.outcome.current.record.id = crypto.randomUUID()
  expect(() => validateRemotePushResultV2(unrelated, actor, request)).toThrow()
  const omitted = structuredClone(response)
  const view = omitted.results[2]
  if (
    view.kind !== "preference" ||
    view.outcome.status !== "applied" ||
    view.outcome.effects.effects[0].store !== "itemViews"
  )
    throw new Error("Expected view fixture")
  view.outcome.effects.effects[0].record.itemId = crypto.randomUUID()
  expect(() => validateRemotePushResultV2(omitted, actor, request)).toThrow()
  for (const invalid of [
    {
      ...response,
      results: [
        response.results[0],
        {
          kind: "item",
          outcome: {
            operationId: request.operations[1].operationId,
            status: "unsupported",
          },
        },
        response.results[2],
      ],
    },
    { ...response, transportVersion: 3 },
    { ...response, extra: true },
    { transportVersion: 2, status: "unauthorized", results: [] },
    { status: "complete", results: response.results },
  ])
    expect(() => validateRemotePushResultV2(invalid, actor, request)).toThrow()
})

test("the input guard counts the complete envelope around an otherwise bounded operation batch", () => {
  const operations: SyncOperation[] = Array.from({ length: 5 }, (_, index) => ({
    protocolVersion: 1,
    operationId: crypto.randomUUID(),
    baseRevision: 0,
    command: {
      type: "item.create",
      itemId: crypto.randomUUID(),
      input: {
        kind: "task",
        title: "Large task",
        description: "",
        scheduledDate: "2026-10-08",
        status: "not_started",
        recurrence: null,
        checklist: Array.from({ length: 100 }, () => ({
          id: crypto.randomUUID(),
          text: "ñ".repeat(index === 4 ? 1 : 500),
          completed: false,
        })),
      },
    },
  }))
  const last = operations[4]
  if (last.command.type !== "item.create" || last.command.input.kind !== "task")
    throw new Error("Expected task input")
  let remaining = maximumRemotePushInputV2Bytes - bytes({ operations })
  expect(remaining).toBeGreaterThan(0)
  for (const entry of last.command.input.checklist) {
    const addition = Math.min(499, Math.floor(remaining / 2))
    entry.text += "ñ".repeat(addition)
    remaining -= addition * 2
  }
  expect(remaining).toBeLessThanOrEqual(1)
  last.command.input.description = "x".repeat(remaining)
  expect(syncBatchSchema.safeParse({ operations }).success).toBe(true)
  expect(bytes({ operations })).toBe(maximumRemotePushInputV2Bytes)
  expect(() =>
    remotePushInputV2Schema.parse({
      transportVersion: 2,
      expectedUserId: actor,
      operations,
    })
  ).toThrow()
})

test("the response byte guard preserves individual outcomes instead of truncating a large result set", () => {
  const results: RemoteOperationResultV2[] = []
  let response = { transportVersion: 2, status: "complete", results }
  do {
    const operationId = crypto.randomUUID()
    const result: RemoteOperationResultV2 = {
      kind: "preference",
      outcome: {
        operationId,
        status: "applied",
        effects: {
          version: 1,
          userId: actor,
          operationId,
          sequence: results.length + 1,
          effects: Array.from({ length: 200 }, (_, index) => ({
            store: "tags" as const,
            record: {
              ...metadata,
              userId: actor,
              id: crypto.randomUUID(),
              name: `${index}${"ñ".repeat(50)}`,
              normalizedName: `${index}${"ñ".repeat(50)}`,
              color: "#123456",
              position: index,
            },
          })),
        },
      },
    }
    expect(remoteOperationResultV2Schema.safeParse(result).success).toBe(true)
    results.push(result)
    response = { transportVersion: 2, status: "complete", results }
  } while (bytes(response) <= maximumRemotePushResultV2Bytes)
  expect(results.length).toBeLessThanOrEqual(50)
  expect(JSON.stringify(response).length).toBeLessThan(
    maximumRemotePushResultV2Bytes
  )
  expect(() => remotePushResultV2Schema.parse(response)).toThrow()
  expect(
    remotePushResultV2Schema.safeParse({
      ...response,
      results: results.slice(0, -1),
    }).success
  ).toBe(true)
})
